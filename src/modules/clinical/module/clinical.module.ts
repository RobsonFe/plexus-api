import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalController } from '../controller/clinical.controller';
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
  providers: [ClinicalService],
})
export class ClinicalModule {}