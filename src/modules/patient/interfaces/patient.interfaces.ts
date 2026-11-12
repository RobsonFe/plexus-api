/**
 * Paciente devolvido pelo contrato gRPC, sem o CPF.
 */
export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  createdAt: string;
}

/**
 * Paginação pedida pelo cliente; zero ou ausente usa o padrão do servidor.
 */
export interface PageRequest {
  page: number;
  limit: number;
}

/**
 * Metadados da página devolvida na listagem.
 */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Dados de cadastro do paciente.
 */
export interface CreatePatientRequest {
  fullName: string;
  cpf: string;
  phone: string;
}

/**
 * Identifica o paciente em Get e Delete.
 */
export interface GetPatientRequest {
  id: string;
}

/**
 * Envelope de resposta com um único paciente.
 */
export interface GetPatientResponse {
  result: Patient;
}

/**
 * Pedido de listagem; `page` chega `null` quando o cliente não o envia.
 */
export interface ListPatientsRequest {
  page: PageRequest | null;
}

/**
 * Página de pacientes com os metadados da paginação.
 */
export interface ListPatientsResponse {
  results: Patient[];
  meta: PageMeta;
}

/**
 * Atualização parcial; campos ausentes não são alterados.
 */
export interface UpdatePatientRequest {
  id: string;
  fullName?: string;
  phone?: string;
}

/**
 * Identifica o paciente a ser removido.
 */
export type DeletePatientRequest = GetPatientRequest;

/**
 * Resultado da remoção do paciente.
 */
export interface DeletePatientResponse {
  success: boolean;
}
