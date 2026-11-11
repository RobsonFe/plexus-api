import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { EXTENSION_BY_MIME } from '../constants/clinical.constants';
import { ClinicalMetadataDto } from '../dto/clinical-metadata.dto';
import {
  ClinicalMetadata,
  ClinicalUploadCall,
  RecordUploadResponse,
  RecordUploadStream,
} from '../interfaces/clinical.interfaces';
import { ClinicalRecordMapper } from '../mapper/clinical-record.mapper';
import { ClinicalRecordRepository } from '../repository/clinical-record.repository';

/**
 * Regras de negócio do upload de prontuários e gravação do arquivo em disco.
 */
@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);
  private readonly storageDirectory: string;
  private readonly maxFileBytes: number;

  constructor(
    private readonly records: ClinicalRecordRepository,
    config: ConfigService,
  ) {
    this.storageDirectory = config.get<string>(
      'STORAGE_DIR',
      path.resolve(process.cwd(), 'storage', 'exams'),
    );
    this.maxFileBytes = Number(config.get('MAX_FILE_BYTES', 104_857_600));
    fs.mkdirSync(this.storageDirectory, { recursive: true });
  }

  /**
   * Registra o prontuário e grava o arquivo recebido por client streaming.
   *
   * @param call Stream gRPC com os metadados no primeiro frame e os chunks em seguida
   * @returns Resumo do upload, sem o caminho interno do arquivo
   * @throws RpcException com status gRPC do erro; falhas inesperadas viram INTERNAL
   */
  public async processClinicalRecordStream(
    call: ClinicalUploadCall,
  ): Promise<RecordUploadResponse> {
    const frames = call.iterator() as AsyncIterableIterator<RecordUploadStream>;
    const recordId = randomUUID();
    const fileId = randomUUID();
    const tempPath = path.join(this.storageDirectory, `${fileId}.part`);
    let finalPath = tempPath;
    let persisted = false;

    try {
      const { value: firstFrame } = await frames.next();
      const metadata = this.validateMetadata(firstFrame?.metadata);
      const fileName = `${fileId}${EXTENSION_BY_MIME[metadata.fileMimeType]}`;
      finalPath = path.join(this.storageDirectory, fileName);
      await this.records.saveRecordWithFile(
        metadata,
        recordId,
        fileId,
        finalPath,
      );
      persisted = true;

      const totalBytes = await this.streamExamToDisk(frames, tempPath);

      // O grpc-js encerra o stream como um fim normal quando o cliente cancela.
      if (call.cancelled) {
        throw new RpcException({
          code: status.CANCELLED,
          message: 'Upload cancelado pelo cliente',
        });
      }

      await rename(tempPath, finalPath);
      await this.records.markFileCompleted(fileId, totalBytes);

      return ClinicalRecordMapper.toUploadResponse(
        recordId,
        fileName,
        totalBytes,
      );
    } catch (error) {
      await Promise.allSettled([
        rm(tempPath, { force: true }),
        rm(finalPath, { force: true }),
        persisted && this.records.markFileFailed(fileId),
      ]);
      throw this.toRpcException(error, fileId);
    }
  }

  /**
   * Preserva erros já tratados e oculta do cliente e do log os detalhes dos demais.
   *
   * @param error Erro capturado durante o upload
   * @param fileId UUID do arquivo, usado para correlacionar o log
   * @returns Exceção com o status gRPC a ser devolvido
   */
  private toRpcException(error: unknown, fileId: string): RpcException {
    if (error instanceof RpcException) {
      return error;
    }

    const { name, code } = error as NodeJS.ErrnoException;
    this.logger.error(`Upload ${fileId} failed: ${name} ${code ?? ''}`);
    return new RpcException({
      code: status.INTERNAL,
      message: 'Erro interno',
    });
  }

  /**
   * Grava os chunks em disco respeitando o backpressure e o limite de tamanho.
   *
   * @param frames Frames restantes do stream, depois dos metadados
   * @param tempPath Caminho temporário do arquivo
   * @returns Total de bytes gravados
   * @throws RpcException INVALID_ARGUMENT com metadados repetidos e RESOURCE_EXHAUSTED acima do limite
   */
  private async streamExamToDisk(
    frames: AsyncIterable<RecordUploadStream>,
    tempPath: string,
  ): Promise<number> {
    const { maxFileBytes } = this;
    const file = fs.createWriteStream(tempPath, { flags: 'wx' });
    let totalBytes = 0;

    try {
      await pipeline(async function* () {
        for await (const frame of frames) {
          if (frame.metadata) {
            throw new RpcException({
              code: status.INVALID_ARGUMENT,
              message: 'Metadados enviados mais de uma vez',
            });
          }

          if (frame.chunk?.data) {
            totalBytes += frame.chunk.data.length;

            if (totalBytes > maxFileBytes) {
              throw new RpcException({
                code: status.RESOURCE_EXHAUSTED,
                message: 'Arquivo excede o limite de 100MB',
              });
            }

            yield frame.chunk.data;
          }
        }
      }, file);
    } finally {
      // No Windows, renomear ou apagar um arquivo ainda aberto falha.
      if (!file.closed) {
        await new Promise<void>((resolve) =>
          file.once('close', () => resolve()),
        );
      }
    }

    return totalBytes;
  }

  /**
   * Normaliza e valida os metadados antes de acessar o banco ou o disco.
   *
   * @param raw Metadados recebidos no primeiro frame, se houver
   * @returns DTO validado, com CPF e telefone contendo apenas dígitos
   * @throws RpcException INVALID_ARGUMENT sem metadados ou com algum campo inválido
   */
  private validateMetadata(raw?: ClinicalMetadata): ClinicalMetadataDto {
    if (!raw) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'O primeiro frame deve conter os metadados',
      });
    }

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
}
