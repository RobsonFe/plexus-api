import type { sendUnaryData, status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcStreamCall, RpcException } from '@nestjs/microservices';
import type {
  ClinicalUploadCall,
  RecordUploadResponse,
} from '../interfaces/clinical.interfaces';
import { ClinicalService } from '../service/clinical.service';

/**
 * gRPC Controller handling incoming remote procedure calls for the ClinicalService.
 */
@Controller()
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  /**
   * Recebe o upload por client streaming e entrega o resultado ao callback,
   * porque o filter global não intercepta `@GrpcStreamCall`.
   *
   * @param call Stream gRPC com os metadados e os chunks do arquivo
   * @param callback Callback que devolve o resumo ou o erro ao cliente
   */
  @GrpcStreamCall('ClinicalService', 'SaveClinicalRecord')
  public saveClinicalRecord(
    call: ClinicalUploadCall,
    callback: sendUnaryData<RecordUploadResponse>,
  ): void {
    void this.clinicalService.processClinicalRecordStream(call).then(
      (response) => callback(null, response),
      (error: RpcException) => {
        const { code, message } = error.getError() as {
          code: status;
          message: string;
        };
        callback({ code, details: message }, null);
      },
    );
  }
}
