import { status } from '@grpc/grpc-js';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { RecordUploadStream } from '../interfaces/clinical.interfaces';
import { ClinicalService } from '../service/clinical.service';

const validMetadata = {
  patientFullName: 'Paciente Teste',
  patientCpf: '11144477735',
  patientPhone: '81999990000',
  doctorNotes: 'Anotação de teste',
  fileName: 'exame.pdf',
  fileMimeType: 'application/pdf',
};
const chunk = { chunk: { data: Buffer.from('conteudo') } };

describe('ClinicalService.processClinicalRecordStream', () => {
  const root = mkdtempSync(join(tmpdir(), 'plexus-clinical-'));
  const cwd = jest.spyOn(process, 'cwd');

  const values = jest.fn().mockReturnThis();
  const set = jest.fn().mockReturnThis();
  const queryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values,
    orUpdate: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set,
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ raw: [{ id: 'patient-id' }] }),
  };
  const dataSource = {
    transaction: jest.fn((run: (manager: unknown) => Promise<void>) =>
      run({ createQueryBuilder: () => queryBuilder }),
    ),
    createQueryBuilder: () => queryBuilder,
  };

  let storage: string;
  let service: ClinicalService;

  beforeEach(() => {
    jest.clearAllMocks();
    const workspace = mkdtempSync(join(root, 'case-'));
    cwd.mockReturnValue(workspace);
    storage = join(workspace, 'storage', 'exams');
    service = new ClinicalService(dataSource as unknown as DataSource);
  });

  afterAll(() => {
    cwd.mockRestore();
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });

  it('saves the file and persists the normalized cpf and phone', async () => {
    const frames = of<RecordUploadStream[]>(
      {
        metadata: {
          ...validMetadata,
          patientCpf: '111.444.777-35',
          patientPhone: '(81) 99999-0000',
        },
      },
      chunk,
    );

    const response = await service.processClinicalRecordStream(frames);

    expect(response.totalBytes).toBe(8);
    expect(response.success).toBe(true);
    expect(readFileSync(response.filePath, 'utf8')).toBe('conteudo');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        documentCpf: '11144477735',
        phone: '81999990000',
      }),
    );
    expect(set).toHaveBeenCalledWith({ sizeBytes: 8, status: 'completed' });
  });

  it('rejects an invalid cpf before opening the file or touching the database', async () => {
    const frames = of<RecordUploadStream[]>({
      metadata: { ...validMetadata, patientCpf: '11144477734' },
    });

    await expect(
      service.processClinicalRecordStream(frames),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'patientCpf deve ser um CPF válido',
      },
    });
    expect(readdirSync(storage)).toEqual([]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a chunk sent before the metadata', async () => {
    await expect(
      service.processClinicalRecordStream(of(chunk)),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'O primeiro frame deve conter os metadados',
      },
    });
    expect(readdirSync(storage)).toEqual([]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects metadata sent twice and marks the upload as failed', async () => {
    const frames = of<RecordUploadStream[]>(
      { metadata: validMetadata },
      { metadata: validMetadata },
    );

    await expect(
      service.processClinicalRecordStream(frames),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'Metadados enviados mais de uma vez',
      },
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('rejects with INTERNAL and marks the upload as failed when the disk write fails', async () => {
    rmSync(storage, { recursive: true });

    await expect(
      service.processClinicalRecordStream(of({ metadata: validMetadata })),
    ).rejects.toMatchObject({
      error: { code: status.INTERNAL, message: 'Erro interno' },
    });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ status: 'failed' });
  });
});
