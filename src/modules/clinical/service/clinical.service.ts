import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RecordUploadStream,
  RecordUploadResponse,
  ClinicalMetadata,
} from '../interfaces/clinical.interfaces';
import { ClinicalMetadataDto } from '../dto/clinical-metadata.dto';
import { PatientEntity } from '../entities/patient.entity';
import { ClinicalRecordEntity } from '../entities/clinical-record.entity';
import { MedicalFileEntity } from '../entities/medical-file.entity';

/**
 * Service responsible for orchestrating clinical record persistence via TypeORM
 * and non-blocking file system streaming.
 */
@Injectable()
export class ClinicalService {
  private readonly storageDirectory = path.resolve(
    process.cwd(),
    'storage',
    'exams',
  );

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.ensureStorageDirectoryExists();
  }

  /**
   * Ensures the target local directory for medical exams exists on bootstrap.
   */
  private ensureStorageDirectoryExists(): void {
    if (!fs.existsSync(this.storageDirectory)) {
      fs.mkdirSync(this.storageDirectory, { recursive: true });
    }
  }

  /**
   * Processes an incoming gRPC client stream containing clinical metadata
   * in the first frame followed by binary file chunks.
   *
   * @param stream$ - The reactive stream of incoming protobuf messages.
   * @returns A promise resolving to the upload summary once disk I/O and DB updates complete.
   */
  public processClinicalRecordStream(
    stream$: Observable<RecordUploadStream>,
  ): Promise<RecordUploadResponse> {
    return new Promise<RecordUploadResponse>((resolve, reject) => {
      let writeStream: fs.WriteStream | null = null;
      let metadataPersistencePromise: Promise<void> | null = null;
      let recordId = '';
      let fileId = '';
      let targetFilePath = '';
      let totalBytesWritten = 0;
      let uploadAborted = false;

      const abortUpload = (failure: Error): void => {
        if (uploadAborted) {
          return;
        }

        uploadAborted = true;
        if (writeStream) {
          writeStream.destroy();
        }

        if (fileId && metadataPersistencePromise) {
          void metadataPersistencePromise
            .catch(() => undefined)
            .then(() => this.markFileUploadAsFailed(fileId))
            .finally(() => reject(failure));
        } else {
          reject(failure);
        }
      };

      stream$.subscribe({
        next: (message: RecordUploadStream) => {
          if (uploadAborted) {
            return;
          }

          try {
            if (message.metadata) {
              if (writeStream) {
                throw new RpcException({
                  code: status.INVALID_ARGUMENT,
                  message: 'Metadados enviados mais de uma vez',
                });
              }

              const metadata = this.validateMetadata(message.metadata);
              const session = this.initializeUploadSession(metadata);
              recordId = session.recordId;
              fileId = session.fileId;
              targetFilePath = session.filePath;

              writeStream = fs.createWriteStream(targetFilePath);
              writeStream.on('error', () =>
                abortUpload(
                  new RpcException({
                    code: status.INTERNAL,
                    message: 'Erro interno',
                  }),
                ),
              );
              metadataPersistencePromise = this.persistMetadata(
                metadata,
                recordId,
                fileId,
                targetFilePath,
              );
              // A falha é tratada no complete ou no abort; sem este catch o Node encerra o processo por unhandled rejection.
              void metadataPersistencePromise.catch(() => undefined);
            } else if (message.chunk?.data) {
              if (!writeStream) {
                throw new RpcException({
                  code: status.INVALID_ARGUMENT,
                  message: 'O primeiro frame deve conter os metadados',
                });
              }
              writeStream.write(message.chunk.data);
              totalBytesWritten += message.chunk.data.length;
            }
          } catch (error) {
            abortUpload(
              error instanceof Error
                ? error
                : new RpcException('Stream processing failed.'),
            );
          }
        },
        error: (err: unknown) => {
          abortUpload(
            new RpcException(
              err instanceof Error ? err.message : 'Unknown stream error.',
            ),
          );
        },
        complete: () => {
          if (uploadAborted) {
            return;
          }

          if (!writeStream || !metadataPersistencePromise) {
            reject(
              new RpcException('Stream completed without initializing a file.'),
            );
            return;
          }

          const activePersistencePromise = metadataPersistencePromise;

          writeStream.once('finish', () => {
            void activePersistencePromise
              .then(() => this.completeFileUpload(fileId, totalBytesWritten))
              .then(() => {
                resolve({
                  recordId,
                  filePath: targetFilePath,
                  totalBytes: totalBytesWritten,
                  success: true,
                });
              })
              .catch((dbError: unknown) => {
                reject(
                  new RpcException(
                    dbError instanceof Error
                      ? dbError.message
                      : 'Database persistence failed.',
                  ),
                );
              });
          });
          writeStream.end();
        },
      });
    });
  }

  /**
   * Normaliza e valida os metadados antes de abrir o arquivo ou acessar o banco.
   *
   * @param raw Metadados como chegaram do cliente gRPC
   * @returns DTO validado, com CPF e telefone contendo apenas dígitos
   * @throws RpcException INVALID_ARGUMENT quando algum campo é inválido
   */
  private validateMetadata(raw: ClinicalMetadata): ClinicalMetadataDto {
    const dto = plainToInstance(ClinicalMetadataDto, raw);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const message = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; ');
      throw new RpcException({ code: status.INVALID_ARGUMENT, message });
    }

    return dto;
  }

  /**
   * Generates unique identifiers and resolves the physical disk path for a new exam.
   *
   * @param metadata - The clinical and patient metadata extracted from frame 1.
   * @returns Object containing generated UUIDs and physical target path.
   */
  private initializeUploadSession(metadata: ClinicalMetadataDto): {
    recordId: string;
    fileId: string;
    filePath: string;
  } {
    const generatedRecordId = randomUUID();
    const generatedFileId = randomUUID();
    const sanitizedExtension = path.extname(metadata.fileName) || '.bin';
    const physicalFileName = `${generatedFileId}${sanitizedExtension}`;
    const resolvedPath = path.join(this.storageDirectory, physicalFileName);

    return {
      recordId: generatedRecordId,
      fileId: generatedFileId,
      filePath: resolvedPath,
    };
  }

  /**
   * Executes a fast-path atomic transaction to upsert the patient and insert
   * the clinical record and medical file entry.
   *
   * @param dtoInstance - Validated metadata payload from frame 1.
   * @param recordId - Pre-generated UUID for the clinical record.
   * @param fileId - Pre-generated UUID for the medical file entry.
   * @param diskPath - Physical path where the file is being streamed.
   */
  private async persistMetadata(
    dtoInstance: ClinicalMetadataDto,
    recordId: string,
    fileId: string,
    diskPath: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const patientUpsertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(PatientEntity)
        .values({
          fullName: dtoInstance.patientFullName,
          documentCpf: dtoInstance.patientCpf,
          phone: dtoInstance.patientPhone,
        })
        .orUpdate(['full_name', 'phone'], ['document_cpf'])
        .returning('id')
        .execute();

      const insertedRows = patientUpsertResult.raw as Array<{ id: string }>;
      const patientId = insertedRows[0]?.id;

      if (!patientId) {
        throw new RpcException('Failed to resolve patient identifier.');
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into(ClinicalRecordEntity)
        .values({
          id: recordId,
          patientId,
          doctorNotes: dtoInstance.doctorNotes,
        })
        .execute();

      await manager
        .createQueryBuilder()
        .insert()
        .into(MedicalFileEntity)
        .values({
          id: fileId,
          recordId,
          originalName: dtoInstance.fileName,
          mimeType: dtoInstance.fileMimeType,
          diskPath,
          sizeBytes: 0,
          status: 'uploading',
        })
        .execute();
    });
  }

  /**
   * Updates the medical file record status to 'completed' along with final byte count.
   *
   * @param fileId - The UUID of the medical file record.
   * @param totalBytes - Total bytes written to the file system.
   */
  private async completeFileUpload(
    fileId: string,
    totalBytes: number,
  ): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(MedicalFileEntity)
      .set({
        sizeBytes: totalBytes,
        status: 'completed',
      })
      .where('id = :id', { id: fileId })
      .execute();
  }

  /**
   * Marks the medical file record as 'failed' if the stream aborts unexpectedly.
   *
   * @param fileId - The UUID of the medical file record.
   */
  private async markFileUploadAsFailed(fileId: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(MedicalFileEntity)
      .set({ status: 'failed' })
      .where('id = :id', { id: fileId })
      .execute();
  }
}