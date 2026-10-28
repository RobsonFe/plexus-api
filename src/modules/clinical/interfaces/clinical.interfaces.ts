/**
 * Metadata payload sent in the initial frame of the clinical upload stream.
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
 * Binary chunk payload representing a slice of the uploaded medical file.
 */
export interface FileChunk {
  data: Buffer;
}

/**
 * Union message received per frame during the gRPC client stream.
 */
export interface RecordUploadStream {
  metadata?: ClinicalMetadata;
  chunk?: FileChunk;
}

/**
 * Final summary returned to the client once the stream completes and persists.
 */
export interface RecordUploadResponse {
  recordId: string;
  filePath: string;
  totalBytes: number;
  success: boolean;
}