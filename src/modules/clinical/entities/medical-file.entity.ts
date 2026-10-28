import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicalRecordEntity } from './clinical-record.entity';

/**
 * Represents metadata and physical storage location for an uploaded medical file.
 */
@Entity({ name: 'medical_files' })
export class MedicalFileEntity {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  public recordId: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  public originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  public mimeType: string;

  @Column({ name: 'disk_path', type: 'text' })
  public diskPath: string;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  public sizeBytes: number;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'uploading' })
  public status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt: Date;

  @ManyToOne(() => ClinicalRecordEntity, (record) => record.medicalFiles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'record_id' })
  public clinicalRecord: ClinicalRecordEntity;
}