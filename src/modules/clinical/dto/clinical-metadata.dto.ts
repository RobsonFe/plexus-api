import { Transform } from 'class-transformer';
import { IsIn, Length, Matches } from 'class-validator';
import { ClinicalMetadata } from '../interfaces/clinical.interfaces';
import { IsCpf } from '../validation/is-cpf.decorator';

/**
 * Validated DTO for the metadata payload sent in the first frame of the upload stream.
 */
export class ClinicalMetadataDto implements ClinicalMetadata {
  @Length(3, 255, { message: 'patientFullName deve ter entre 3 e 255 caracteres' })
  public patientFullName: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @IsCpf()
  public patientCpf: string;

  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'patientPhone deve conter de 10 a 13 dígitos' })
  public patientPhone: string;

  @Length(1, 20_000, { message: 'doctorNotes deve ter entre 1 e 20.000 caracteres' })
  public doctorNotes: string;

  @Length(1, 255, { message: 'fileName deve ter entre 1 e 255 caracteres' })
  public fileName: string;

  @IsIn(['application/pdf', 'image/png', 'image/jpeg'], {
    message: 'fileMimeType deve ser PDF, PNG ou JPEG',
  })
  public fileMimeType: string;
}
