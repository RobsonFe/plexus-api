import { Transform } from 'class-transformer';
import { Length, Matches } from 'class-validator';
import { IsCpf } from '../../clinical/validation/is-cpf.decorator';



export class CreatePatientDto {
  @Length(3, 255, { message: 'fullName deve ter entre 3 e 255 caracteres' })
  public fullName: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @IsCpf()
  public cpf: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'phone deve conter de 10 a 13 dígitos' })
  public phone: string;
}
