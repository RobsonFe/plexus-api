import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ClinicalMetadataDto } from '../dto/clinical-metadata.dto';
import { ClinicalRecordEntity } from '../entities/clinical-record.entity';
import { MedicalFileEntity } from '../entities/medical-file.entity';
import { PatientEntity } from '../entities/patient.entity';
import { ClinicalRecordRepository } from '../repository/clinical-record.repository';

const metadata: ClinicalMetadataDto = {
  patientFullName: 'Paciente Teste',
  patientCpf: '11144477735',
  patientPhone: '81999990000',
  doctorNotes: 'Anotação de teste',
  fileName: 'exame.pdf',
  fileMimeType: 'application/pdf',
};

describe('ClinicalRecordRepository', () => {
  const into = jest.fn().mockReturnThis();
  const values = jest.fn().mockReturnThis();
  const update = jest.fn().mockReturnThis();
  const set = jest.fn().mockReturnThis();
  const where = jest.fn().mockReturnThis();
  const execute = jest.fn();
  const queryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into,
    values,
    orUpdate: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update,
    set,
    where,
    execute,
  };
  const manager = {
    createQueryBuilder: () => queryBuilder,
    insert: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((run: (active: typeof manager) => Promise<void>) =>
      run(manager),
    ),
    createQueryBuilder: () => queryBuilder,
  };

  let repository: ClinicalRecordRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    execute.mockReset();
    execute.mockResolvedValue({ raw: [] });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicalRecordRepository,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    repository = moduleRef.get(ClinicalRecordRepository);
  });

  it('writes the patient, the record and the file in one transaction', async () => {
    execute.mockResolvedValueOnce({ raw: [{ id: 'patient-id' }] });

    await repository.saveRecordWithFile(
      metadata,
      'record-id',
      'file-id',
      '/storage/file-id.pdf',
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(into).toHaveBeenCalledWith(PatientEntity);
    expect(values).toHaveBeenCalledWith({
      fullName: 'Paciente Teste',
      documentCpf: '11144477735',
      phone: '81999990000',
    });
    expect(manager.insert.mock.calls).toEqual([
      [
        ClinicalRecordEntity,
        {
          id: 'record-id',
          patientId: 'patient-id',
          doctorNotes: 'Anotação de teste',
        },
      ],
      [
        MedicalFileEntity,
        {
          id: 'file-id',
          recordId: 'record-id',
          originalName: 'exame.pdf',
          mimeType: 'application/pdf',
          diskPath: '/storage/file-id.pdf',
          sizeBytes: 0,
          status: 'uploading',
        },
      ],
    ]);
  });

  it('does not insert the record or the file when the patient id is missing', async () => {
    await expect(
      repository.saveRecordWithFile(
        metadata,
        'record-id',
        'file-id',
        '/storage/file-id.pdf',
      ),
    ).rejects.toThrow('Failed to resolve patient identifier.');

    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('marks the file as completed with the total bytes', async () => {
    await repository.markFileCompleted('file-id', 2048);

    expect(update).toHaveBeenCalledWith(MedicalFileEntity);
    expect(set).toHaveBeenCalledWith({ sizeBytes: 2048, status: 'completed' });
    expect(where).toHaveBeenCalledWith('id = :id', { id: 'file-id' });
  });

  it('marks the file as failed', async () => {
    await repository.markFileFailed('file-id');

    expect(update).toHaveBeenCalledWith(MedicalFileEntity);
    expect(set).toHaveBeenCalledWith({ status: 'failed' });
    expect(where).toHaveBeenCalledWith('id = :id', { id: 'file-id' });
  });
});
