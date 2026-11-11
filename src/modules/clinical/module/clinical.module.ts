import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalController } from '../controller/clinical.controller';
import { ClinicalRecordRepository } from '../repository/clinical-record.repository';
import { ClinicalService } from '../service/clinical.service';
import { PatientEntity } from '../entities/patient.entity';
import { ClinicalRecordEntity } from '../entities/clinical-record.entity';
import { MedicalFileEntity } from '../entities/medical-file.entity';

/**
 * Agrupa a lógica do domínio clínico, os controllers gRPC e as entities do TypeORM.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientEntity,
      ClinicalRecordEntity,
      MedicalFileEntity,
    ]),
  ],
  controllers: [ClinicalController],
  providers: [ClinicalService, ClinicalRecordRepository],
})
export class ClinicalModule {}
