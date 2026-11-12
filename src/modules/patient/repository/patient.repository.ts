import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { PatientEntity } from '../entities/patient.entity';

/**
 * Única camada do módulo de pacientes que conhece o TypeORM.
 * As buscas ignoram pacientes removidos (soft delete), salvo quando indicado.
 */
@Injectable()
export class PatientRepository {
  constructor(
    @InjectRepository(PatientEntity)
    private readonly patients: Repository<PatientEntity>,
  ) {}

  /**
   * Cadastra um novo paciente.
   *
   * @param data Dados validados do cadastro
   * @returns Paciente persistido
   */
  public create(data: CreatePatientDto): Promise<PatientEntity> {
    return this.patients.save(
      this.patients.create({
        fullName: data.fullName,
        documentCpf: data.cpf,
        phone: data.phone,
      }),
    );
  }

  /**
   * Reativa um paciente removido, atualizando nome e telefone.
   *
   * @param id UUID do paciente removido
   * @param data Dados validados do novo cadastro
   * @returns Paciente reativado
   */
  public async restore(
    id: string,
    data: CreatePatientDto,
  ): Promise<PatientEntity> {
    await this.patients.update(
      { id },
      { fullName: data.fullName, phone: data.phone, deletedAt: null },
    );
    return this.patients.findOneByOrFail({ id });
  }

  /**
   * Busca o paciente pelo CPF, incluindo os removidos.
   *
   * @param cpf CPF normalizado (só dígitos)
   * @returns Paciente encontrado ou `null`
   */
  public findByCpfWithDeleted(cpf: string): Promise<PatientEntity | null> {
    return this.patients.findOne({
      where: { documentCpf: cpf },
      withDeleted: true,
    });
  }

  /**
   * Busca um paciente ativo pelo id.
   *
   * @param id UUID do paciente
   * @returns Paciente encontrado ou `null`
   */
  public findById(id: string): Promise<PatientEntity | null> {
    return this.patients.findOneBy({ id });
  }

  /**
   * Lista os pacientes ativos, mais recentes primeiro, sem carregar o CPF.
   *
   * @param page Página (começa em 1)
   * @param limit Quantidade de itens por página
   * @returns Pacientes da página e o total de pacientes ativos
   */
  public findPage(
    page: number,
    limit: number,
  ): Promise<[PatientEntity[], number]> {
    return this.patients.findAndCount({
      select: { id: true, fullName: true, phone: true, createdAt: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Atualiza os campos informados de um paciente ativo; campos `undefined` são ignorados.
   *
   * @param id UUID do paciente
   * @param data Campos a alterar (ao menos um definido)
   * @returns Paciente atualizado ou `null` quando não existe paciente ativo com o id
   */
  public async update(
    id: string,
    data: Partial<Pick<PatientEntity, 'fullName' | 'phone'>>,
  ): Promise<PatientEntity | null> {
    const { affected } = await this.patients.update(
      { id, deletedAt: IsNull() },
      data,
    );
    return affected ? this.patients.findOneBy({ id }) : null;
  }

  /**
   * Remove logicamente um paciente ativo, preservando os prontuários.
   *
   * @param id UUID do paciente
   * @returns `true` quando um paciente ativo foi removido
   */
  public async softDelete(id: string): Promise<boolean> {
    const { affected } = await this.patients.softDelete({
      id,
      deletedAt: IsNull(),
    });
    return affected === 1;
  }
}
