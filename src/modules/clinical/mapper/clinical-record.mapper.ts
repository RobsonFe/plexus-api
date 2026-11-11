import { RecordUploadResponse } from '../interfaces/clinical.interfaces';

/**
 * Converte os dados do prontuário nas mensagens do contrato gRPC.
 */
export class ClinicalRecordMapper {
  /**
   * Monta o resumo devolvido ao cliente ao final do upload.
   *
   * @param recordId UUID do prontuário
   * @param fileName Nome do arquivo gerado pelo servidor, sem o caminho interno
   * @param totalBytes Total de bytes recebidos no stream
   * @returns Mensagem `RecordUploadResponse`
   */
  public static toUploadResponse(
    recordId: string,
    fileName: string,
    totalBytes: number,
  ): RecordUploadResponse {
    return { recordId, filePath: fileName, totalBytes, success: true };
  }
}
