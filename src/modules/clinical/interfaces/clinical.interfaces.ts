import type { ServerReadableStream } from '@grpc/grpc-js';

/**
 * Metadados enviados no frame inicial do stream de upload clínico.
 */
export interface ClinicalMetadata {
  patientFullName: string;
  patientCpf: string;
  patientPhone: string;
  doctorNotes: string;
  fileName: string;
  fileMimeType: string;
}

/**
 * Trecho binário de um arquivo médico enviado.
 */
export interface FileChunk {
  data: Buffer;
}

/**
 * União das mensagens recebidas em cada frame do client stream gRPC.
 */
export interface RecordUploadStream {
  metadata?: ClinicalMetadata;
  chunk?: FileChunk;
}

/**
 * Resumo devolvido ao cliente quando o stream termina e os dados são persistidos.
 */
export interface RecordUploadResponse {
  recordId: string;
  filePath: string;
  totalBytes: number;
  success: boolean;
}

/**
 * Client stream gRPC cru do upload clínico.
 */
export type ClinicalUploadCall = ServerReadableStream<
  RecordUploadStream,
  RecordUploadResponse
>;
