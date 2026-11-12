import {
  credentials,
  loadPackageDefinition,
  ServiceClientConstructor,
  ServiceError,
  status,
  type Client,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CreateClinicalTables1794359808538 } from '../src/database/migrations/1794359808538-CreateClinicalTables';
import { AddPatientsDeletedAt1794452947973 } from '../src/database/migrations/1794452947973-AddPatientsDeletedAt';
import { createGrpcOptions } from '../src/grpc.options';
import {
  CreatePatientRequest,
  DeletePatientResponse,
  GetPatientResponse,
  ListPatientsResponse,
  PageRequest,
  UpdatePatientRequest,
} from '../src/modules/patient/interfaces/patient.interfaces';

type Unary<Req, Res> = (
  request: Req,
  callback: (error: ServiceError | null, response?: Res) => void,
) => void;
type PatientClient = Client & {
  createPatient: Unary<CreatePatientRequest, GetPatientResponse>;
  getPatient: Unary<{ id: string }, GetPatientResponse>;
  listPatients: Unary<{ page?: PageRequest }, ListPatientsResponse>;
  updatePatient: Unary<UpdatePatientRequest, GetPatientResponse>;
  deletePatient: Unary<{ id: string }, DeletePatientResponse>;
};

const URL = 'localhost:50098';
const MISSING_ID = '3f1c2a4e-8b7d-4c6e-9a1b-2d3e4f5a6b7c';
const ana: CreatePatientRequest = {
  fullName: 'Ana Fictícia',
  cpf: '11144477735',
  phone: '81999990000',
};

describe('PatientService (e2e gRPC)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let client: PatientClient | undefined;

  const rpc = <Req, Res>(method: Unary<Req, Res>, request: Req) =>
    new Promise<Res>((resolve, reject) =>
      method.call(client, request, (error, response) =>
        error || !response ? reject(error as Error) : resolve(response),
      ),
    );
  const api = () => client as PatientClient;
  const create = (request: CreatePatientRequest) =>
    rpc(api().createPatient, request);
  const get = (id: string) => rpc(api().getPatient, { id });
  const list = (page?: PageRequest) => rpc(api().listPatients, { page });
  const update = (request: UpdatePatientRequest) =>
    rpc(api().updatePatient, request);
  const remove = (id: string) => rpc(api().deletePatient, { id });

  beforeAll(async () => {
    process.env.DB_DATABASE = 'plexusdb_test';
    process.env.GRPC_URL = URL;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    const grpcOptions = createGrpcOptions(app.get(ConfigService));
    app.connectMicroservice<MicroserviceOptions>(grpcOptions, {
      inheritAppConfig: true,
    });
    await app.startAllMicroservices();
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query(
      'DROP TABLE IF EXISTS medical_files, clinical_records, patients CASCADE',
    );
    const queryRunner = dataSource.createQueryRunner();
    await new CreateClinicalTables1794359808538().up(queryRunner);
    await new AddPatientsDeletedAt1794452947973().up(queryRunner);
    await queryRunner.release();

    const pkg = loadPackageDefinition(
      loadSync(
        join(__dirname, '../src/modules/patient/proto/patient.proto'),
        grpcOptions.options.loader,
      ),
    ) as unknown as {
      plexus: { patient: { v1: { PatientService: ServiceClientConstructor } } };
    };
    client = new pkg.plexus.patient.v1.PatientService(
      URL,
      credentials.createInsecure(),
    ) as unknown as PatientClient;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE patients CASCADE');
  });

  afterAll(async () => {
    client?.close();
    await app?.close();
  });

  it('runs the full CRUD and reactivates a removed patient with the same id', async () => {
    const created = await create(ana);
    const { id } = created.result;

    expect(created).toEqual({
      result: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        fullName: 'Ana Fictícia',
        phone: '81999990000',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
    expect(await get(id)).toEqual(created);

    const listed = await list();
    expect(listed.results).toEqual([created.result]);

    const updated = await update({ id, phone: '81988887777' });
    expect(updated.result).toEqual({
      ...created.result,
      fullName: 'Ana Fictícia',
      phone: '81988887777',
    });

    expect(await remove(id)).toEqual({ success: true });
    await expect(get(id)).rejects.toMatchObject({
      code: status.NOT_FOUND,
      details: 'Paciente não encontrado',
    });
    expect(await list()).toEqual({
      results: [],
      meta: { page: 1, limit: 20, total: 0 },
    });

    const reactivated = await create({
      ...ana,
      fullName: 'Ana Reativada',
      phone: '81911112222',
    });
    expect(reactivated.result).toEqual({
      id,
      fullName: 'Ana Reativada',
      phone: '81911112222',
      createdAt: created.result.createdAt,
    });
    expect(await get(id)).toEqual(reactivated);
  });

  it('returns ALREADY_EXISTS for an active patient with the same cpf', async () => {
    await create(ana);

    await expect(
      create({ ...ana, fullName: 'Outra Pessoa' }),
    ).rejects.toMatchObject({
      code: status.ALREADY_EXISTS,
      details: 'Paciente já cadastrado',
    });
    const rows = (await dataSource.query(
      'SELECT full_name FROM patients',
    )) as Array<{ full_name: string }>;
    expect(rows).toEqual([{ full_name: 'Ana Fictícia' }]);
  });

  it('returns INVALID_ARGUMENT for an invalid cpf without echoing it', async () => {
    const error = (await create({ ...ana, cpf: '11144477734' }).catch(
      (caught: unknown) => caught,
    )) as ServiceError;

    expect(error).toMatchObject({
      code: status.INVALID_ARGUMENT,
      details: 'cpf deve ser um CPF válido',
    });
    expect(error.details).not.toContain('11144477734');
    expect(await dataSource.query('SELECT id FROM patients')).toEqual([]);
  });

  it('persists formatted cpf and phone normalized to digits', async () => {
    const created = await create({
      ...ana,
      cpf: '111.444.777-35',
      phone: '(81) 99999-0000',
    });

    expect(created.result.phone).toBe('81999990000');
    const rows = (await dataSource.query(
      'SELECT document_cpf, phone FROM patients',
    )) as Array<{ document_cpf: string; phone: string }>;
    expect(rows).toEqual([
      { document_cpf: '11144477735', phone: '81999990000' },
    ]);
  });

  it('returns INVALID_ARGUMENT for a malformed id', async () => {
    await expect(get('abc')).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
      details: 'id deve ser um UUID válido',
    });
  });

  it('returns NOT_FOUND for an unknown id', async () => {
    await expect(get(MISSING_ID)).rejects.toMatchObject({
      code: status.NOT_FOUND,
      details: 'Paciente não encontrado',
    });
  });

  it('returns INVALID_ARGUMENT when the update has no fields', async () => {
    const { result } = await create(ana);

    await expect(update({ id: result.id })).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
      details: 'Informe ao menos um campo para atualizar',
    });
  });

  it('returns INVALID_ARGUMENT for an empty fullName without changing the patient', async () => {
    const { result } = await create(ana);

    await expect(update({ id: result.id, fullName: '' })).rejects.toMatchObject(
      {
        code: status.INVALID_ARGUMENT,
        details: 'fullName deve ter entre 3 e 255 caracteres',
      },
    );
    expect((await get(result.id)).result.fullName).toBe('Ana Fictícia');
  });

  it('returns NOT_FOUND when updating an unknown id', async () => {
    await expect(
      update({ id: MISSING_ID, fullName: 'Ninguém' }),
    ).rejects.toMatchObject({ code: status.NOT_FOUND });
  });

  it('soft deletes once, keeps the row and returns NOT_FOUND on the second delete', async () => {
    const { result } = await create(ana);

    await remove(result.id);

    await expect(remove(result.id)).rejects.toMatchObject({
      code: status.NOT_FOUND,
      details: 'Paciente não encontrado',
    });
    const rows = (await dataSource.query(
      'SELECT deleted_at FROM patients WHERE id = $1',
      [result.id],
    )) as Array<{ deleted_at: Date | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).toBeInstanceOf(Date);
  });

  it('paginates the active patients and never returns the cpf', async () => {
    await create(ana);
    await create({ ...ana, fullName: 'Bruno Fictício', cpf: '52998224725' });
    await create({ ...ana, fullName: 'Carla Fictícia', cpf: '39053344705' });

    const page = await list({ page: 2, limit: 2 });

    expect(page.results).toHaveLength(1);
    expect(page.meta).toEqual({ page: 2, limit: 2, total: 3 });
    const everything = JSON.stringify([page, await list()]);
    for (const cpf of ['11144477735', '52998224725', '39053344705']) {
      expect(everything).not.toContain(cpf);
    }
  });

  it('uses page 1 and limit 20 when no page is sent', async () => {
    await create(ana);

    expect((await list()).meta).toEqual({ page: 1, limit: 20, total: 1 });
  });
});
