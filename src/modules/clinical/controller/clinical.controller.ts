import { Controller } from '@nestjs/common';
import { GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { ClinicalService } from '../service/clinical.service';
import {
  RecordUploadStream,
  RecordUploadResponse,
} from '../interfaces/clinical.interfaces';

/**
 * gRPC Controller handling incoming remote procedure calls for the ClinicalService.
 */
@Controller()
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  /**
   * Handles the SaveClinicalRecord client-streaming RPC.
   *
   * @param messages - Observable stream of incoming client messages.
   * @returns Summary of the persisted clinical record and file location.
   */
  @GrpcStreamMethod('ClinicalService', 'SaveClinicalRecord')
  public saveClinicalRecord(
    messages: Observable<RecordUploadStream>,
  ): Promise<RecordUploadResponse> {
    return this.clinicalService.processClinicalRecordStream(messages);
  }
}