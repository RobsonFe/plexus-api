import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalController } from '../controller/clinical.controller';
import { ClinicalRecordRepository } from '../repository/clinical-record.repository';
import { ClinicalService } from '../service/clinical.service';
import { PatientEntity } from '../entities/patient.entity';
import { ClinicalRecordEntity } from '../entities/clinical-record.entity';
import { MedicalFileEntity } from '../entities/medical-file.entity';

/**
 * Encapsulates clinical domain logic, gRPC controllers, and TypeORM entities.
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
