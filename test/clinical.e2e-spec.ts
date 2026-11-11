import {
  ClientWritableStream,
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
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CreateClinicalTables1794359808538 } from '../src/database/migrations/1794359808538-CreateClinicalTables';
import { createGrpcOptions } from '../src/grpc.options';
import {
  RecordUploadResponse,
  RecordUploadStream,
} from '../src/modules/clinical/interfaces/clinical.interfaces';

type UploadCallback = (
  error: ServiceError | null,
  response?: RecordUploadResponse,
) => void;
type ClinicalClient = Client & {
  saveClinicalRecord: (
    callback: UploadCallback,
  ) => ClientWritableStream<RecordUploadStream>;
};

const URL = 'localhost:50099';
const metadata = {
  patientFullName: 'Paciente Teste',
  patientCpf: '111.444.777-35',
  patientPhone: '(81) 99999-0000',
  doctorNotes: 'Anotação de teste',
  fileName: 'exame.pdf',
  fileMimeType: 'application/pdf',
};
const chunk = (size: number) => ({ chunk: { data: Buffer.alloc(size, 1) } });

describe('ClinicalService (e2e gRPC)', () => {
  const storage = mkdtempSync(join(tmpdir(), 'plexus-e2e-'));
  let app: INestApplication;
  let dataSource: DataSource;
  let client: ClinicalClient;

  const upload = (frames: RecordUploadStream[]) =>
    new Promise<RecordUploadResponse>((resolve, reject) => {
      const call = client.saveClinicalRecord((error, response) =>
        error || !response ? reject(error as Error) : resolve(response),
      );
      frames.forEach((frame) => call.write(frame));
      call.end();
    });
  const fileStatus = async () => {
    const rows = (await dataSource.query(
      'SELECT status FROM medical_files',
    )) as Array<{ status: string }>;
    return rows[0]?.status;
  };
  const waitForStatus = async (expected: string) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if ((await fileStatus()) === expected) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Status ${expected} não alcançado`);
  };

  beforeAll(async () => {
    process.env.DB_DATABASE = 'plexusdb_test';
    process.env.STORAGE_DIR = storage;
    process.env.MAX_FILE_BYTES = '1024';
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
    await new CreateClinicalTables1794359808538().up(
      dataSource.createQueryRunner(),
    );

    const pkg = loadPackageDefinition(
      loadSync(
        join(__dirname, '../src/proto/clinical.proto'),
        grpcOptions.options.loader,
      ),
    ) as unknown as {
      plexus: { clinic: { v1: { ClinicalService: ServiceClientConstructor } } };
    };
    client = new pkg.plexus.clinic.v1.ClinicalService(
      URL,
      credentials.createInsecure(),
    ) as unknown as ClinicalClient;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE patients CASCADE');
    rmSync(storage, { recursive: true, force: true });
    mkdirSync(storage, { recursive: true });
  });

  afterAll(async () => {
    client.close();
    await app.close();
    rmSync(storage, { recursive: true, force: true, maxRetries: 5 });
  });

  it('stores a file of exactly the limit and persists the record', async () => {
    const response = await upload([{ metadata }, chunk(1000), chunk(24)]);

    expect(response).toEqual({
      recordId: expect.any(String),
      filePath: expect.stringMatching(/^[0-9a-f-]{36}\.pdf$/),
      totalBytes: 1024,
      success: true,
    });
    expect(readdirSync(storage)).toEqual([response.filePath]);
    expect(readFileSync(join(storage, response.filePath))).toHaveLength(1024);

    const [patient] = (await dataSource.query(
      'SELECT document_cpf, phone FROM patients',
    )) as Array<{ document_cpf: string; phone: string }>;
    const [file] = (await dataSource.query(
      'SELECT status, size_bytes, disk_path FROM medical_files',
    )) as Array<{ status: string; size_bytes: string; disk_path: string }>;

    expect(patient).toEqual({
      document_cpf: '11144477735',
      phone: '81999990000',
    });
    expect(file).toEqual({
      status: 'completed',
      size_bytes: '1024',
      disk_path: join(storage, response.filePath),
    });
  });

  it('returns INVALID_ARGUMENT for invalid metadata without persisting', async () => {
    await expect(
      upload([{ metadata: { ...metadata, patientCpf: '11144477734' } }]),
    ).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
      details: 'patientCpf deve ser um CPF válido',
    });
    expect(await fileStatus()).toBeUndefined();
    expect(readdirSync(storage)).toEqual([]);
  });

  it('returns INVALID_ARGUMENT when the first frame is a chunk', async () => {
    await expect(upload([chunk(10)])).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
      details: 'O primeiro frame deve conter os metadados',
    });
  });

  it('returns RESOURCE_EXHAUSTED above the limit and removes the file', async () => {
    await expect(
      upload([{ metadata }, chunk(1000), chunk(25)]),
    ).rejects.toMatchObject({
      code: status.RESOURCE_EXHAUSTED,
      details: 'Arquivo excede o limite de 100MB',
    });
    expect(await fileStatus()).toBe('failed');
    expect(readdirSync(storage)).toEqual([]);
  });

  it('marks the upload as failed and removes the file when the client cancels', async () => {
    const call = client.saveClinicalRecord(() => undefined);
    call.write({ metadata });
    call.write(chunk(10));
    await waitForStatus('uploading');

    call.cancel();

    await waitForStatus('failed');
    expect(readdirSync(storage)).toEqual([]);
  });
});
