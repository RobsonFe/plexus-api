import { status } from '@grpc/grpc-js';
import { PipeTransform } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { PatientController } from '../controller/patient.controller';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { PatientService } from '../service/patient.service';

const PATIENT_ID = '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b';
const patientResponse = {
  result: {
    id: PATIENT_ID,
    fullName: 'Paciente Teste',
    phone: '81999990000',
    createdAt: '2026-01-02T03:04:05.000Z',
  },
};

describe('PatientController', () => {
  const service: jest.Mocked<
    Pick<
      PatientService,
      | 'createPatient'
      | 'getPatient'
      | 'listPatients'
      | 'updatePatient'
      | 'deletePatient'
    >
  > = {
    createPatient: jest.fn(),
    getPatient: jest.fn(),
    listPatients: jest.fn(),
    updatePatient: jest.fn(),
    deletePatient: jest.fn(),
  };
  let controller: PatientController;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [{ provide: PatientService, useValue: service }],
    }).compile();
    controller = moduleRef.get(PatientController);
  });

  it('delegates CreatePatient', async () => {
    const data: CreatePatientDto = {
      fullName: 'Paciente Teste',
      cpf: '11144477735',
      phone: '81999990000',
    };
    service.createPatient.mockResolvedValueOnce(patientResponse);

    expect(await controller.createPatient(data)).toBe(patientResponse);
    expect(service.createPatient).toHaveBeenCalledWith(data);
  });

  it('delegates GetPatient with the id', async () => {
    service.getPatient.mockResolvedValueOnce(patientResponse);

    expect(await controller.getPatient({ id: PATIENT_ID })).toBe(
      patientResponse,
    );
    expect(service.getPatient).toHaveBeenCalledWith(PATIENT_ID);
  });

  it('delegates ListPatients', async () => {
    const response = {
      results: [patientResponse.result],
      meta: { page: 1, limit: 20, total: 1 },
    };
    service.listPatients.mockResolvedValueOnce(response);

    expect(await controller.listPatients({ page: null })).toBe(response);
    expect(service.listPatients).toHaveBeenCalledWith({ page: null });
  });

  it('delegates UpdatePatient', async () => {
    const data: UpdatePatientDto = { id: PATIENT_ID, phone: '81911112222' };
    service.updatePatient.mockResolvedValueOnce(patientResponse);

    expect(await controller.updatePatient(data)).toBe(patientResponse);
    expect(service.updatePatient).toHaveBeenCalledWith(data);
  });

  it('delegates DeletePatient with the id', async () => {
    service.deletePatient.mockResolvedValueOnce({ success: true });

    expect(await controller.deletePatient({ id: PATIENT_ID })).toEqual({
      success: true,
    });
    expect(service.deletePatient).toHaveBeenCalledWith(PATIENT_ID);
  });

  it('propagates the service RpcException', async () => {
    const error = new RpcException({
      code: status.NOT_FOUND,
      message: 'Paciente não encontrado',
    });
    service.getPatient.mockRejectedValueOnce(error);

    await expect(controller.getPatient({ id: PATIENT_ID })).rejects.toBe(error);
  });

  describe('validation pipe', () => {
    const [pipe] = Reflect.getMetadata(
      PIPES_METADATA,
      PatientController,
    ) as PipeTransform[];

    it('turns validation errors into INVALID_ARGUMENT naming the fields', async () => {
      const error = (await Promise.resolve(
        pipe.transform(
          { fullName: 'Al', cpf: '11144477734', phone: '81999990000' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).catch((caught: unknown) => caught)) as RpcException;

      expect(error).toBeInstanceOf(RpcException);
      expect(error.getError()).toEqual({
        code: status.INVALID_ARGUMENT,
        message:
          'fullName deve ter entre 3 e 255 caracteres; cpf deve ser um CPF válido',
      });
    });

    it('strips proto-loader oneof markers and the cpf from updates', async () => {
      const dto = (await pipe.transform(
        {
          id: PATIENT_ID,
          phone: '81911112222',
          _phone: 'phone',
          cpf: '11144477735',
        },
        { type: 'body', metatype: UpdatePatientDto },
      )) as UpdatePatientDto;

      expect(dto).toBeInstanceOf(UpdatePatientDto);
      expect(Object.fromEntries(Object.entries(dto))).toEqual({
        id: PATIENT_ID,
        phone: '81911112222',
      });
    });
  });
});
