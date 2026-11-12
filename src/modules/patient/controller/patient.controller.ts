import { status } from '@grpc/grpc-js';
import {
  Controller,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { GrpcMethod, Payload, RpcException } from '@nestjs/microservices';
import { GrpcExceptionFilter } from '../../../common/filters/grpc-exception.filter';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { PatientIdDto } from '../dto/patient-id.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import type {
  DeletePatientResponse,
  GetPatientResponse,
  ListPatientsRequest,
  ListPatientsResponse,
} from '../interfaces/patient.interfaces';
import { PatientService } from '../service/patient.service';

/**
 * Controller gRPC que atende as chamadas do `PatientService`.
 */
@Controller()
@UseFilters(GrpcExceptionFilter)
@UsePipes(
  // Sem forbidNonWhitelisted: o proto-loader adiciona props `_campo` aos campos `optional`.
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) =>
      new RpcException({
        code: status.INVALID_ARGUMENT,
        message: errors
          .flatMap((error) => Object.values(error.constraints ?? {}))
          .join('; '),
      }),
  }),
)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @GrpcMethod('PatientService', 'CreatePatient')
  public createPatient(
    @Payload() data: CreatePatientDto,
  ): Promise<GetPatientResponse> {
    return this.patientService.createPatient(data);
  }

  @GrpcMethod('PatientService', 'GetPatient')
  public getPatient(
    @Payload() data: PatientIdDto,
  ): Promise<GetPatientResponse> {
    return this.patientService.getPatient(data.id);
  }

  @GrpcMethod('PatientService', 'ListPatients')
  public listPatients(
    @Payload() data: ListPatientsRequest,
  ): Promise<ListPatientsResponse> {
    return this.patientService.listPatients(data);
  }

  @GrpcMethod('PatientService', 'UpdatePatient')
  public updatePatient(
    @Payload() data: UpdatePatientDto,
  ): Promise<GetPatientResponse> {
    return this.patientService.updatePatient(data);
  }

  @GrpcMethod('PatientService', 'DeletePatient')
  public deletePatient(
    @Payload() data: PatientIdDto,
  ): Promise<DeletePatientResponse> {
    return this.patientService.deletePatient(data.id);
  }
}
