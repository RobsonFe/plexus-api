import { Transform } from 'class-transformer';
import { Length, Matches } from 'class-validator';
import { IsCpf } from '../../../common/validation/is-cpf.decorator';
import { CreatePatientRequest } from '../interfaces/patient.interfaces';

/**
 * DTO validado do cadastro de paciente; CPF e telefone são normalizados para dígitos.
 */
export class CreatePatientDto implements CreatePatientRequest {
  @Length(3, 255, { message: 'fullName deve ter entre 3 e 255 caracteres' })
  public fullName: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @IsCpf()
  public cpf: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'phone deve conter de 10 a 13 dígitos' })
  public phone: string;
}
