import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { PatientEntity } from '../entities/patient.entity';
import { PatientRepository } from '../repository/patient.repository';
import { PatientService } from '../service/patient.service';

const PATIENT_ID = '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b';
const createData = {
  fullName: 'Paciente Teste',
  cpf: '11144477735',
  phone: '81999990000',
};
const patientEntity = (overrides: Partial<PatientEntity> = {}) =>
  Object.assign(new PatientEntity(), {
    id: PATIENT_ID,
    fullName: 'Paciente Teste',
    documentCpf: '11144477735',
    phone: '81999990000',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    deletedAt: null,
    ...overrides,
  });
const patientMessage = {
  id: PATIENT_ID,
  fullName: 'Paciente Teste',
  phone: '81999990000',
  createdAt: '2026-01-02T03:04:05.000Z',
};
const rpcError = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(RpcException);
  return (error as RpcException).getError();
};

describe('PatientService', () => {
  const repository: jest.Mocked<
    Pick<
      PatientRepository,
      | 'create'
      | 'restore'
      | 'findByCpfWithDeleted'
      | 'findById'
      | 'findPage'
      | 'update'
      | 'softDelete'
    >
  > = {
    create: jest.fn(),
    restore: jest.fn(),
    findByCpfWithDeleted: jest.fn(),
    findById: jest.fn(),
    findPage: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  let service: PatientService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: PatientRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(PatientService);
  });

  describe('createPatient', () => {
    it('creates a new patient and returns it without the cpf', async () => {
      repository.findByCpfWithDeleted.mockResolvedValueOnce(null);
      repository.create.mockResolvedValueOnce(patientEntity());

      const response = await service.createPatient(createData);

      expect(response).toEqual({ result: patientMessage });
      expect(repository.findByCpfWithDeleted).toHaveBeenCalledWith(
        '11144477735',
      );
      expect(repository.create).toHaveBeenCalledWith(createData);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('rejects an active cpf with ALREADY_EXISTS without writing', async () => {
      repository.findByCpfWithDeleted.mockResolvedValueOnce(patientEntity());

      expect(await rpcError(service.createPatient(createData))).toEqual({
        code: status.ALREADY_EXISTS,
        message: 'Paciente já cadastrado',
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('restores a soft-deleted patient with the same cpf', async () => {
      repository.findByCpfWithDeleted.mockResolvedValueOnce(
        patientEntity({ deletedAt: new Date('2026-02-01T00:00:00.000Z') }),
      );
      repository.restore.mockResolvedValueOnce(
        patientEntity({ fullName: 'Paciente Reativado' }),
      );

      const response = await service.createPatient({
        ...createData,
        fullName: 'Paciente Reativado',
      });

      expect(response).toEqual({
        result: { ...patientMessage, fullName: 'Paciente Reativado' },
      });
      expect(repository.restore).toHaveBeenCalledWith(PATIENT_ID, {
        ...createData,
        fullName: 'Paciente Reativado',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propagates repository errors', async () => {
      const failure = new Error('connection lost');
      repository.findByCpfWithDeleted.mockResolvedValueOnce(null);
      repository.create.mockRejectedValueOnce(failure);

      await expect(service.createPatient(createData)).rejects.toBe(failure);
    });
  });

  describe('getPatient', () => {
    it('returns the active patient', async () => {
      repository.findById.mockResolvedValueOnce(patientEntity());

      expect(await service.getPatient(PATIENT_ID)).toEqual({
        result: patientMessage,
      });
      expect(repository.findById).toHaveBeenCalledWith(PATIENT_ID);
    });

    it('returns NOT_FOUND when the patient does not exist', async () => {
      repository.findById.mockResolvedValueOnce(null);

      expect(await rpcError(service.getPatient(PATIENT_ID))).toEqual({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    });
  });

  describe('listPatients', () => {
    it('returns the mapped page with its meta', async () => {
      const second = patientEntity({
        id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        fullName: 'Outra Paciente',
        phone: '81988887777',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      repository.findPage.mockResolvedValueOnce([
        [patientEntity(), second],
        12,
      ]);

      const response = await service.listPatients({
        page: { page: 2, limit: 5 },
      });

      expect(response).toEqual({
        results: [
          patientMessage,
          {
            id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
            fullName: 'Outra Paciente',
            phone: '81988887777',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { page: 2, limit: 5, total: 12 },
      });
      expect(repository.findPage).toHaveBeenCalledWith(2, 5);
    });

    it.each([
      ['missing page', null, 1, 20],
      ['zeroed page', { page: 0, limit: 0 }, 1, 20],
      ['limit above the cap', { page: 1, limit: 500 }, 1, 100],
      ['negative page', { page: -3, limit: 10 }, 1, 10],
      ['negative limit', { page: 2, limit: -5 }, 2, 1],
    ])('normalizes %s', async (_case, page, expectedPage, expectedLimit) => {
      repository.findPage.mockResolvedValueOnce([[], 0]);

      const response = await service.listPatients({ page });

      expect(repository.findPage).toHaveBeenCalledWith(
        expectedPage,
        expectedLimit,
      );
      expect(response).toEqual({
        results: [],
        meta: { page: expectedPage, limit: expectedLimit, total: 0 },
      });
    });
  });

  describe('updatePatient', () => {
    it('updates the informed fields and returns the patient', async () => {
      repository.update.mockResolvedValueOnce(
        patientEntity({ fullName: 'Nome Novo', phone: '81911112222' }),
      );
      const data: UpdatePatientDto = {
        id: PATIENT_ID,
        fullName: 'Nome Novo',
        phone: '81911112222',
      };

      expect(await service.updatePatient(data)).toEqual({
        result: {
          ...patientMessage,
          fullName: 'Nome Novo',
          phone: '81911112222',
        },
      });
      expect(repository.update).toHaveBeenCalledWith(PATIENT_ID, {
        fullName: 'Nome Novo',
        phone: '81911112222',
      });
    });

    it('passes only the phone when the name is not informed', async () => {
      repository.update.mockResolvedValueOnce(
        patientEntity({ phone: '81911112222' }),
      );

      await service.updatePatient({ id: PATIENT_ID, phone: '81911112222' });

      expect(repository.update).toHaveBeenCalledWith(PATIENT_ID, {
        fullName: undefined,
        phone: '81911112222',
      });
    });

    it('rejects an update without fields before touching the repository', async () => {
      expect(await rpcError(service.updatePatient({ id: PATIENT_ID }))).toEqual(
        {
          code: status.INVALID_ARGUMENT,
          message: 'Informe ao menos um campo para atualizar',
        },
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when there is no active patient with the id', async () => {
      repository.update.mockResolvedValueOnce(null);

      expect(
        await rpcError(
          service.updatePatient({ id: PATIENT_ID, fullName: 'Nome Novo' }),
        ),
      ).toEqual({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    });
  });

  describe('deletePatient', () => {
    it('soft deletes the patient', async () => {
      repository.softDelete.mockResolvedValueOnce(true);

      expect(await service.deletePatient(PATIENT_ID)).toEqual({
        success: true,
      });
      expect(repository.softDelete).toHaveBeenCalledWith(PATIENT_ID);
    });

    it('returns NOT_FOUND when the patient is missing or already deleted', async () => {
      repository.softDelete.mockResolvedValueOnce(false);

      expect(await rpcError(service.deletePatient(PATIENT_ID))).toEqual({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    });
  });
});
