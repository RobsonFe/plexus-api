import { PatientEntity } from '../entities/patient.entity';
import { Patient } from '../interfaces/patient.interfaces';

/**
 * Converte a entity de paciente na mensagem do contrato gRPC.
 */
export class PatientMapper {
  /**
   * Monta a mensagem `Patient`, sem o CPF (minimização LGPD).
   *
   * @param entity Paciente persistido
   * @returns Mensagem `Patient`
   */
  public static toMessage(entity: PatientEntity): Patient {
    return {
      id: entity.id,
      fullName: entity.fullName,
      phone: entity.phone,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
