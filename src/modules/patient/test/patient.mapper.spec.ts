import { PatientEntity } from '../entities/patient.entity';
import { PatientMapper } from '../mapper/patient.mapper';

describe('PatientMapper.toMessage', () => {
  it('maps the entity to the proto message without the cpf', () => {
    const entity = Object.assign(new PatientEntity(), {
      id: '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b',
      fullName: 'Paciente Teste',
      documentCpf: '11144477735',
      phone: '81999990000',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      deletedAt: null,
    });

    const message = PatientMapper.toMessage(entity);

    expect(message).toStrictEqual({
      id: '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b',
      fullName: 'Paciente Teste',
      phone: '81999990000',
      createdAt: '2026-01-02T03:04:05.000Z',
    });
    expect(JSON.stringify(message)).not.toContain('11144477735');
  });
});
