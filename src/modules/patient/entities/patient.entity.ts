import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ClinicalRecordEntity } from '../../clinical/entities/clinical-record.entity';

/**
 * Representa um paciente cadastrado na plataforma clínica Plexus.
 */
@Entity({ name: 'patients' })
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  public fullName: string;

  @Column({ name: 'document_cpf', type: 'varchar', length: 14, unique: true })
  public documentCpf: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  public phone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  public deletedAt: Date | null;

  @OneToMany(() => ClinicalRecordEntity, (record) => record.patient)
  public clinicalRecords: ClinicalRecordEntity[];
}
