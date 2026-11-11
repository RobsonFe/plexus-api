import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClinicalMetadataDto } from '../dto/clinical-metadata.dto';

const validMetadata = {
  patientFullName: 'Paciente Teste',
  patientCpf: '11144477735',
  patientPhone: '81999990000',
  doctorNotes: 'Anotação de teste',
  fileName: 'exame.pdf',
  fileMimeType: 'application/pdf',
};

const validateCpf = async (patientCpf: string) => {
  const dto = plainToInstance(ClinicalMetadataDto, { ...validMetadata, patientCpf });
  const errors = await validate(dto);
  return errors.filter((error) => error.property === 'patientCpf');
};

describe('ClinicalMetadataDto patientCpf', () => {
  it.each(['11144477735', '111.444.777-35', '11144477905'])('accepts cpf %p', async (cpf) => {
    expect(await validateCpf(cpf)).toHaveLength(0);
  });

  it.each(['', 'abc', '123', '111444777350', '11111111111', '11144477725', '11144477734'])(
    'rejects cpf %p',
    async (cpf) => {
      expect(await validateCpf(cpf)).toHaveLength(1);
    },
  );

  it('does not echo the cpf in the error message', async () => {
    const [error] = await validateCpf('11144477734');

    expect(error?.constraints).toEqual({ isCpf: 'patientCpf deve ser um CPF válido' });
  });
});
