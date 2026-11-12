import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { PatientEntity } from '../entities/patient.entity';
import { PatientRepository } from '../repository/patient.repository';

const PATIENT_ID = '6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b';
const createData = {
  fullName: 'Paciente Teste',
  cpf: '11144477735',
  phone: '81999990000',
};
const stored = Object.assign(new PatientEntity(), {
  id: PATIENT_ID,
  fullName: 'Paciente Teste',
  documentCpf: '11144477735',
  phone: '81999990000',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  deletedAt: null,
});

describe('PatientRepository', () => {
  const orm = {
    create: jest.fn((data: Partial<PatientEntity>) =>
      Object.assign(new PatientEntity(), data),
    ),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    findAndCount: jest.fn(),
  };
  let repository: PatientRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PatientRepository,
        { provide: getRepositoryToken(PatientEntity), useValue: orm },
      ],
    }).compile();
    repository = moduleRef.get(PatientRepository);
  });

  it('creates the patient mapping the cpf to documentCpf', async () => {
    orm.save.mockResolvedValueOnce(stored);

    expect(await repository.create(createData)).toBe(stored);
    expect(orm.create).toHaveBeenCalledWith({
      fullName: 'Paciente Teste',
      documentCpf: '11144477735',
      phone: '81999990000',
    });
    expect(orm.save).toHaveBeenCalledWith(
      Object.assign(new PatientEntity(), {
        fullName: 'Paciente Teste',
        documentCpf: '11144477735',
        phone: '81999990000',
      }),
    );
  });

  it('restores the patient clearing deletedAt and reloads it', async () => {
    orm.update.mockResolvedValueOnce({ affected: 1 });
    orm.findOneByOrFail.mockResolvedValueOnce(stored);

    expect(await repository.restore(PATIENT_ID, createData)).toBe(stored);
    expect(orm.update).toHaveBeenCalledWith(
      { id: PATIENT_ID },
      { fullName: 'Paciente Teste', phone: '81999990000', deletedAt: null },
    );
    expect(orm.findOneByOrFail).toHaveBeenCalledWith({ id: PATIENT_ID });
  });

  it('finds by cpf including soft-deleted patients', async () => {
    orm.findOne.mockResolvedValueOnce(null);

    expect(await repository.findByCpfWithDeleted('11144477735')).toBeNull();
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { documentCpf: '11144477735' },
      withDeleted: true,
    });
  });

  it('finds an active patient by id', async () => {
    orm.findOneBy.mockResolvedValueOnce(stored);

    expect(await repository.findById(PATIENT_ID)).toBe(stored);
    expect(orm.findOneBy).toHaveBeenCalledWith({ id: PATIENT_ID });
  });

  it('paginates without selecting the cpf, newest first', async () => {
    orm.findAndCount.mockResolvedValueOnce([[stored], 21]);

    expect(await repository.findPage(3, 10)).toEqual([[stored], 21]);
    expect(orm.findAndCount).toHaveBeenCalledWith({
      select: { id: true, fullName: true, phone: true, createdAt: true },
      order: { createdAt: 'DESC' },
      skip: 20,
      take: 10,
    });
  });

  it('updates only active patients and returns the reloaded entity', async () => {
    orm.update.mockResolvedValueOnce({ affected: 1 });
    orm.findOneBy.mockResolvedValueOnce(stored);

    expect(await repository.update(PATIENT_ID, { phone: '81911112222' })).toBe(
      stored,
    );
    expect(orm.update).toHaveBeenCalledWith(
      { id: PATIENT_ID, deletedAt: IsNull() },
      { phone: '81911112222' },
    );
    expect(orm.findOneBy).toHaveBeenCalledWith({ id: PATIENT_ID });
  });

  it('returns null without reloading when no active patient was updated', async () => {
    orm.update.mockResolvedValueOnce({ affected: 0 });

    expect(
      await repository.update(PATIENT_ID, { fullName: 'Nome Novo' }),
    ).toBeNull();
    expect(orm.findOneBy).not.toHaveBeenCalled();
  });

  it.each([
    [1, true],
    [0, false],
  ])(
    'soft deletes only active patients (affected %p → %p)',
    async (affected, expected) => {
      orm.softDelete.mockResolvedValueOnce({ affected });

      expect(await repository.softDelete(PATIENT_ID)).toBe(expected);
      expect(orm.softDelete).toHaveBeenCalledWith({
        id: PATIENT_ID,
        deletedAt: IsNull(),
      });
    },
  );
});
