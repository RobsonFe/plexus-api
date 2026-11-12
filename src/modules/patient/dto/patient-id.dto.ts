import { IsUUID } from 'class-validator';
import { GetPatientRequest } from '../interfaces/patient.interfaces';

/**
 * DTO validado do id do paciente, usado em Get, Update e Delete.
 */
export class PatientIdDto implements GetPatientRequest {
  @IsUUID('4', { message: 'id deve ser um UUID válido' })
  public id: string;
}
