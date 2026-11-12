import { IntersectionType, OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePatientDto } from './create-patient.dto';
import { PatientIdDto } from './patient-id.dto';

/**
 * DTO validado da atualização parcial; o CPF não pode ser alterado.
 */
export class UpdatePatientDto extends IntersectionType(
  PatientIdDto,
  PartialType(OmitType(CreatePatientDto, ['cpf'] as const)),
) {}
