import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { PatientIdDto } from '../dto/patient-id.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';

const PATIENT_ID = '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b';
const validCreate = {
  fullName: 'Paciente Teste',
  cpf: '11144477735',
  phone: '81999990000',
};
const constraintsOf = async <T extends object>(
  type: new () => T,
  plain: object,
) => {
  const errors = await validate(plainToInstance(type, plain), {
    whitelist: true,
  });
  return Object.fromEntries(
    errors.map((error) => [error.property, error.constraints]),
  );
};

describe('CreatePatientDto', () => {
  it('normalizes the cpf and the phone to digits', async () => {
    const dto = plainToInstance(CreatePatientDto, {
      fullName: 'Paciente Teste',
      cpf: '111.444.777-35',
      phone: '(81) 99999-0000',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto).toEqual({
      fullName: 'Paciente Teste',
      cpf: '11144477735',
      phone: '81999990000',
    });
  });

  it.each([
    [
      'short name',
      { fullName: 'Al' },
      'fullName',
      { isLength: 'fullName deve ter entre 3 e 255 caracteres' },
    ],
    [
      'long name',
      { fullName: 'a'.repeat(256) },
      'fullName',
      { isLength: 'fullName deve ter entre 3 e 255 caracteres' },
    ],
    [
      'cpf with wrong check digit',
      { cpf: '111.444.777-34' },
      'cpf',
      { isCpf: 'cpf deve ser um CPF válido' },
    ],
    [
      'repeated cpf',
      { cpf: '11111111111' },
      'cpf',
      { isCpf: 'cpf deve ser um CPF válido' },
    ],
    [
      'short phone',
      { phone: '819999' },
      'phone',
      { matches: 'phone deve conter de 10 a 13 dígitos' },
    ],
    [
      'long phone',
      { phone: '55819999900001' },
      'phone',
      { matches: 'phone deve conter de 10 a 13 dígitos' },
    ],
  ])(
    'rejects %s without echoing the value',
    async (_case, override, field, expected) => {
      const constraints = await constraintsOf(CreatePatientDto, {
        ...validCreate,
        ...override,
      });

      expect(constraints).toEqual({ [field]: expected });
      expect(JSON.stringify(constraints)).not.toContain(
        Object.values(override)[0],
      );
    },
  );

  it('rejects missing fields', async () => {
    expect(Object.keys(await constraintsOf(CreatePatientDto, {}))).toEqual([
      'fullName',
      'cpf',
      'phone',
    ]);
  });
});

describe('PatientIdDto', () => {
  it('accepts a uuid v4', async () => {
    expect(await constraintsOf(PatientIdDto, { id: PATIENT_ID })).toEqual({});
  });

  it.each(['', 'not-a-uuid', '6f1c2a8e-3b4d-1e5f-9a6b-7c8d9e0f1a2b'])(
    'rejects id %p',
    async (id) => {
      expect(await constraintsOf(PatientIdDto, { id })).toEqual({
        id: { isUuid: 'id deve ser um UUID válido' },
      });
    },
  );
});

describe('UpdatePatientDto', () => {
  it('accepts only the id at the dto level', async () => {
    expect(await constraintsOf(UpdatePatientDto, { id: PATIENT_ID })).toEqual(
      {},
    );
  });

  it('rejects an invalid id', async () => {
    expect(
      await constraintsOf(UpdatePatientDto, {
        id: 'invalid',
        fullName: 'Nome Novo',
      }),
    ).toEqual({ id: { isUuid: 'id deve ser um UUID válido' } });
  });

  it('rejects an empty name sent explicitly', async () => {
    expect(
      await constraintsOf(UpdatePatientDto, { id: PATIENT_ID, fullName: '' }),
    ).toEqual({
      fullName: { isLength: 'fullName deve ter entre 3 e 255 caracteres' },
    });
  });

  it('normalizes the phone and validates it', async () => {
    const dto = plainToInstance(UpdatePatientDto, {
      id: PATIENT_ID,
      phone: '(81) 99999-0000',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.phone).toBe('81999990000');
    expect(
      await constraintsOf(UpdatePatientDto, { id: PATIENT_ID, phone: '123' }),
    ).toEqual({ phone: { matches: 'phone deve conter de 10 a 13 dígitos' } });
  });

  it('strips the cpf and the proto-loader oneof markers', async () => {
    const dto = plainToInstance(UpdatePatientDto, {
      id: PATIENT_ID,
      fullName: 'Nome Novo',
      _fullName: 'fullName',
      cpf: '11144477735',
    });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(Object.keys(dto)).not.toContain('cpf');
    expect(Object.keys(dto)).not.toContain('_fullName');
    expect(dto.fullName).toBe('Nome Novo');
  });
});
