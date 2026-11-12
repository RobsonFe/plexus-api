import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PatientEntity } from '../../patient/entities/patient.entity';
import { MedicalFileEntity } from './medical-file.entity';

/**
 * Representa o prontuário de uma consulta, associado a um paciente.
 */
@Entity({ name: 'clinical_records' })
export class ClinicalRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  public patientId: string;

  @Column({ name: 'doctor_notes', type: 'text' })
  public doctorNotes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt: Date;

  @ManyToOne(() => PatientEntity, (patient) => patient.clinicalRecords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  public patient: PatientEntity;

  @OneToMany(() => MedicalFileEntity, (file) => file.clinicalRecord)
  public medicalFiles: MedicalFileEntity[];
}