import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import {
  DeletePatientResponse,
  GetPatientResponse,
  ListPatientsRequest,
  ListPatientsResponse,
} from '../interfaces/patient.interfaces';
import { PatientMapper } from '../mapper/patient.mapper';
import { PatientRepository } from '../repository/patient.repository';

/**
 * Regras de negócio do cadastro de pacientes.
 */
@Injectable()
export class PatientService {
  constructor(private readonly patientRepository: PatientRepository) {}

  /**
   * Cadastra o paciente ou reativa o cadastro removido com o mesmo CPF.
   *
   * @param data Dados validados do cadastro
   * @returns Paciente cadastrado ou reativado
   * @throws RpcException ALREADY_EXISTS quando já existe paciente ativo com o CPF
   */
  public async createPatient(
    data: CreatePatientDto,
  ): Promise<GetPatientResponse> {
    const existing = await this.patientRepository.findByCpfWithDeleted(
      data.cpf,
    );

    if (existing && !existing.deletedAt) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'Paciente já cadastrado',
      });
    }

    const patient = existing
      ? await this.patientRepository.restore(existing.id, data)
      : await this.patientRepository.create(data);
    return { result: PatientMapper.toMessage(patient) };
  }

  /**
   * Busca um paciente ativo.
   *
   * @param id UUID do paciente
   * @returns Paciente encontrado
   * @throws RpcException NOT_FOUND quando o paciente não existe ou foi removido
   */
  public async getPatient(id: string): Promise<GetPatientResponse> {
    const patient = await this.patientRepository.findById(id);

    if (!patient) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    }

    return { result: PatientMapper.toMessage(patient) };
  }

  /**
   * Lista os pacientes ativos paginados; página padrão 1 e limite padrão 20, com teto de 100.
   *
   * @param request Paginação pedida pelo cliente (zero ou ausente usa o padrão)
   * @returns Pacientes da página e os metadados da paginação
   */
  public async listPatients(
    request: ListPatientsRequest,
  ): Promise<ListPatientsResponse> {
    const page = Math.max(request.page?.page || 1, 1);
    const limit = Math.min(Math.max(request.page?.limit || 20, 1), 100);
    const [patients, total] = await this.patientRepository.findPage(
      page,
      limit,
    );

    return {
      results: patients.map((patient) => PatientMapper.toMessage(patient)),
      meta: { page, limit, total },
    };
  }

  /**
   * Atualiza nome e/ou telefone de um paciente ativo.
   *
   * @param data Id do paciente e campos a alterar
   * @returns Paciente atualizado
   * @throws RpcException INVALID_ARGUMENT quando nenhum campo é informado
   * @throws RpcException NOT_FOUND quando o paciente não existe ou foi removido
   */
  public async updatePatient(
    data: UpdatePatientDto,
  ): Promise<GetPatientResponse> {
    if (data.fullName === undefined && data.phone === undefined) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Informe ao menos um campo para atualizar',
      });
    }

    const patient = await this.patientRepository.update(data.id, {
      fullName: data.fullName,
      phone: data.phone,
    });

    if (!patient) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    }

    return { result: PatientMapper.toMessage(patient) };
  }

  /**
   * Remove logicamente um paciente ativo, preservando os prontuários.
   *
   * @param id UUID do paciente
   * @returns Confirmação da remoção
   * @throws RpcException NOT_FOUND quando o paciente não existe ou já foi removido
   */
  public async deletePatient(id: string): Promise<DeletePatientResponse> {
    if (!(await this.patientRepository.softDelete(id))) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Paciente não encontrado',
      });
    }

    return { success: true };
  }
}
