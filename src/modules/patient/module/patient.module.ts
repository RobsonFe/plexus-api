import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientEntity } from '../entities/patient.entity';
import { PatientRepository } from '../repository/patient.repository';
import { PatientService } from '../service/patient.service';
import { PatientController } from '../controller/patient.controller';

/**
 * Agrupa a lógica do domínio clínico, os controllers gRPC e as entities do TypeORM.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientEntity,
      PatientRepository,
    ]),
  ],
  controllers: [PatientController],
  providers: [PatientRepository, PatientService],
})
export class ClinicalModule {}
