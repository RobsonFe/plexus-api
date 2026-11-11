import { status } from '@grpc/grpc-js';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createWriteStream,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  WriteStream,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import {
  ClinicalUploadCall,
  RecordUploadStream,
} from '../interfaces/clinical.interfaces';
import { ClinicalRecordRepository } from '../repository/clinical-record.repository';
import { ClinicalService } from '../service/clinical.service';

jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  return { ...actual, createWriteStream: jest.fn(actual.createWriteStream) };
});

const validMetadata = {
  patientFullName: 'Paciente Teste',
  patientCpf: '11144477735',
  patientPhone: '81999990000',
  doctorNotes: 'Anotação de teste',
  fileName: 'exame.pdf',
  fileMimeType: 'application/pdf',
};
const chunk = { chunk: { data: Buffer.from('conteudo') } };
const uploadCall = (frames: RecordUploadStream[]) =>
  Readable.from(frames) as unknown as ClinicalUploadCall;
const internalError = {
  error: { code: status.INTERNAL, message: 'Erro interno' },
};

describe('ClinicalService.processClinicalRecordStream', () => {
  const root = mkdtempSync(join(tmpdir(), 'plexus-clinical-'));
  const records = {
    saveRecordWithFile: jest.fn(),
    markFileCompleted: jest.fn(),
    markFileFailed: jest.fn(),
  };
  const logError = jest.spyOn(Logger.prototype, 'error');

  let storage: string;
  let service: ClinicalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    logError.mockImplementation(() => undefined);
    records.saveRecordWithFile.mockResolvedValue(undefined);
    records.markFileCompleted.mockResolvedValue(undefined);
    records.markFileFailed.mockResolvedValue(undefined);
    storage = mkdtempSync(join(root, 'case-'));

    const settings: Record<string, unknown> = {
      STORAGE_DIR: storage,
      MAX_FILE_BYTES: 16,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicalService,
        { provide: ClinicalRecordRepository, useValue: records },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => settings[key] },
        },
      ],
    }).compile();
    service = moduleRef.get(ClinicalService);
  });

  afterAll(() => {
    logError.mockRestore();
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });

  it('stores the file and persists the normalized cpf and phone', async () => {
    const response = await service.processClinicalRecordStream(
      uploadCall([
        {
          metadata: {
            ...validMetadata,
            patientCpf: '111.444.777-35',
            patientPhone: '(81) 99999-0000',
          },
        },
        chunk,
      ]),
    );

    expect(response).toEqual({
      recordId: expect.any(String),
      filePath: expect.stringMatching(/^[0-9a-f-]{36}\.pdf$/),
      totalBytes: 8,
      success: true,
    });
    expect(readdirSync(storage)).toEqual([response.filePath]);
    expect(readFileSync(join(storage, response.filePath), 'utf8')).toBe(
      'conteudo',
    );
    expect(records.saveRecordWithFile).toHaveBeenCalledWith(
      expect.objectContaining({
        patientCpf: '11144477735',
        patientPhone: '81999990000',
      }),
      response.recordId,
      expect.any(String),
      join(storage, response.filePath),
    );
    expect(records.markFileCompleted).toHaveBeenCalledWith(
      expect.any(String),
      8,
    );
  });

  it('uses the extension of the validated mime type instead of the client file name', async () => {
    const response = await service.processClinicalRecordStream(
      uploadCall([
        {
          metadata: {
            ...validMetadata,
            fileName: '../../malware.exe',
            fileMimeType: 'image/png',
          },
        },
        chunk,
      ]),
    );

    expect(response.filePath).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(readdirSync(storage)).toEqual([response.filePath]);
  });

  it('accepts a file of exactly the size limit', async () => {
    const response = await service.processClinicalRecordStream(
      uploadCall([{ metadata: validMetadata }, chunk, chunk]),
    );

    expect(response.totalBytes).toBe(16);
  });

  it('rejects a file above the size limit and leaves nothing on disk', async () => {
    await expect(
      service.processClinicalRecordStream(
        uploadCall([{ metadata: validMetadata }, chunk, chunk, chunk]),
      ),
    ).rejects.toMatchObject({
      error: {
        code: status.RESOURCE_EXHAUSTED,
        message: 'Arquivo excede o limite de 100MB',
      },
    });
    expect(readdirSync(storage)).toEqual([]);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
    expect(records.markFileCompleted).not.toHaveBeenCalled();
  });

  it('stops reading frames while the disk is busy', async () => {
    let pulledChunks = 0;
    const blockedDisk = new Writable({
      highWaterMark: 1,
      write: () => undefined,
    });
    jest
      .mocked(createWriteStream)
      .mockReturnValueOnce(blockedDisk as unknown as WriteStream);
    const source = Readable.from(
      (async function* () {
        yield { metadata: validMetadata };
        for (let index = 0; index < 8; index += 1) {
          pulledChunks += 1;
          yield { chunk: { data: Buffer.from('ab') } };
        }
      })(),
      { highWaterMark: 1 },
    );

    const upload = service.processClinicalRecordStream(
      source as unknown as ClinicalUploadCall,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(pulledChunks).toBeLessThan(8);

    blockedDisk.destroy(new Error('falha de disco'));
    await expect(upload).rejects.toMatchObject(internalError);
  });

  it('rejects an invalid cpf before opening the file or touching the database', async () => {
    await expect(
      service.processClinicalRecordStream(
        uploadCall([
          { metadata: { ...validMetadata, patientCpf: '11144477734' } },
          chunk,
        ]),
      ),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'patientCpf deve ser um CPF válido',
      },
    });
    expect(createWriteStream).not.toHaveBeenCalled();
    expect(records.saveRecordWithFile).not.toHaveBeenCalled();
  });

  it.each([
    ['a chunk before the metadata', [chunk]],
    ['an empty stream', []],
  ])('rejects %s', async (_scenario, frames) => {
    await expect(
      service.processClinicalRecordStream(uploadCall(frames)),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'O primeiro frame deve conter os metadados',
      },
    });
    expect(createWriteStream).not.toHaveBeenCalled();
    expect(records.saveRecordWithFile).not.toHaveBeenCalled();
  });

  it('rejects metadata sent twice and removes the partial file', async () => {
    await expect(
      service.processClinicalRecordStream(
        uploadCall([
          { metadata: validMetadata },
          chunk,
          { metadata: validMetadata },
        ]),
      ),
    ).rejects.toMatchObject({
      error: {
        code: status.INVALID_ARGUMENT,
        message: 'Metadados enviados mais de uma vez',
      },
    });
    expect(readdirSync(storage)).toEqual([]);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
  });

  it('hides the original database error from the client and the log', async () => {
    records.saveRecordWithFile.mockRejectedValueOnce(
      new Error('duplicate key 11144477735'),
    );

    await expect(
      service.processClinicalRecordStream(
        uploadCall([{ metadata: validMetadata }, chunk]),
      ),
    ).rejects.toMatchObject(internalError);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('Error'));
    expect(logError).not.toHaveBeenCalledWith(
      expect.stringContaining('11144477735'),
    );
    expect(createWriteStream).not.toHaveBeenCalled();
    expect(records.markFileFailed).not.toHaveBeenCalled();
  });

  it('returns INTERNAL and marks the upload as failed when the disk write fails', async () => {
    rmSync(storage, { recursive: true });

    await expect(
      service.processClinicalRecordStream(
        uploadCall([{ metadata: validMetadata }, chunk]),
      ),
    ).rejects.toMatchObject(internalError);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
    expect(records.markFileCompleted).not.toHaveBeenCalled();
  });

  it('removes the stored file when the final status cannot be saved', async () => {
    records.markFileCompleted.mockRejectedValueOnce(
      new Error('falha de banco'),
    );

    await expect(
      service.processClinicalRecordStream(
        uploadCall([{ metadata: validMetadata }, chunk]),
      ),
    ).rejects.toMatchObject(internalError);
    expect(readdirSync(storage)).toEqual([]);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
  });

  it('keeps the original failure when marking the upload as failed also fails', async () => {
    records.markFileFailed.mockRejectedValueOnce(new Error('falha de banco'));

    await expect(
      service.processClinicalRecordStream(
        uploadCall([{ metadata: validMetadata }, { metadata: validMetadata }]),
      ),
    ).rejects.toMatchObject({
      error: { code: status.INVALID_ARGUMENT },
    });
  });

  it('discards a cancelled upload whose stream ended like a normal one', async () => {
    const call = Object.assign(
      uploadCall([{ metadata: validMetadata }, chunk]),
      { cancelled: true },
    );

    await expect(
      service.processClinicalRecordStream(call),
    ).rejects.toMatchObject({
      error: { code: status.CANCELLED },
    });
    expect(readdirSync(storage)).toEqual([]);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
    expect(records.markFileCompleted).not.toHaveBeenCalled();
  });

  it('cleans up when the stream fails midway', async () => {
    const source = Readable.from(
      (async function* () {
        yield { metadata: validMetadata };
        yield chunk;
        throw new Error('conexão perdida');
      })(),
    );

    await expect(
      service.processClinicalRecordStream(
        source as unknown as ClinicalUploadCall,
      ),
    ).rejects.toMatchObject(internalError);
    expect(readdirSync(storage)).toEqual([]);
    expect(records.markFileFailed).toHaveBeenCalledTimes(1);
  });
});
