import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClinicalMetadataDto } from '../dto/clinical-metadata.dto';
import { ClinicalRecordEntity } from '../entities/clinical-record.entity';
import { MedicalFileEntity } from '../entities/medical-file.entity';
import { PatientEntity } from '../entities/patient.entity';

/**
 * Única camada do módulo clínico que conhece o TypeORM.
 */
@Injectable()
export class ClinicalRecordRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Faz o upsert do paciente e cria o prontuário e o registro do arquivo numa única transação.
   *
   * @param metadata Metadados validados do primeiro frame
   * @param recordId UUID gerado para o prontuário
   * @param fileId UUID gerado para o arquivo médico
   * @param diskPath Caminho físico onde o arquivo está sendo gravado
   * @returns Promise resolvida após o commit
   * @throws Error quando o id do paciente não é retornado pelo upsert
   */
  public async saveRecordWithFile(
    metadata: ClinicalMetadataDto,
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
          fullName: metadata.patientFullName,
          documentCpf: metadata.patientCpf,
          phone: metadata.patientPhone,
        })
        .orUpdate(['full_name', 'phone'], ['document_cpf'])
        .returning('id')
        .execute();

      const insertedRows = patientUpsertResult.raw as Array<{ id: string }>;
      const patientId = insertedRows[0]?.id;

      if (!patientId) {
        throw new Error('Failed to resolve patient identifier.');
      }

      await manager.insert(ClinicalRecordEntity, {
        id: recordId,
        patientId,
        doctorNotes: metadata.doctorNotes,
      });

      await manager.insert(MedicalFileEntity, {
        id: fileId,
        recordId,
        originalName: metadata.fileName,
        mimeType: metadata.fileMimeType,
        diskPath,
        sizeBytes: 0,
        status: 'uploading',
      });
    });
  }

  /**
   * Marca o arquivo médico como concluído e registra o total de bytes.
   *
   * @param fileId UUID do arquivo médico
   * @param totalBytes Total de bytes gravados em disco
   * @returns Promise resolvida após a atualização
   */
  public async markFileCompleted(
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
   * Marca o arquivo médico como falho quando o upload é interrompido.
   *
   * @param fileId UUID do arquivo médico
   * @returns Promise resolvida após a atualização
   */
  public async markFileFailed(fileId: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(MedicalFileEntity)
      .set({ status: 'failed' })
      .where('id = :id', { id: fileId })
      .execute();
  }
}
