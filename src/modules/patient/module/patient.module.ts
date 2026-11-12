import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from '../controller/patient.controller';
import { PatientEntity } from '../entities/patient.entity';
import { PatientRepository } from '../repository/patient.repository';
import { PatientService } from '../service/patient.service';

/**
 * Agrupa o CRUD gRPC de pacientes: controller, regras de negócio e persistência.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity])],
  controllers: [PatientController],
  providers: [PatientRepository, PatientService],
})
export class PatientModule {}
