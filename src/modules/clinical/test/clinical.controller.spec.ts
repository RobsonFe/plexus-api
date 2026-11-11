import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { ClinicalController } from '../controller/clinical.controller';
import { ClinicalUploadCall } from '../interfaces/clinical.interfaces';
import { ClinicalService } from '../service/clinical.service';

describe('ClinicalController.saveClinicalRecord', () => {
  const call = {} as ClinicalUploadCall;
  const processClinicalRecordStream = jest.fn();
  let controller: ClinicalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ClinicalController],
      providers: [
        {
          provide: ClinicalService,
          useValue: { processClinicalRecordStream },
        },
      ],
    }).compile();
    controller = moduleRef.get(ClinicalController);
  });

  it('sends the upload summary to the callback', async () => {
    const response = {
      recordId: 'record-id',
      filePath: 'file-id.pdf',
      totalBytes: 8,
      success: true,
    };
    processClinicalRecordStream.mockResolvedValueOnce(response);
    const callback = jest.fn();

    controller.saveClinicalRecord(call, callback);
    await new Promise(setImmediate);

    expect(processClinicalRecordStream).toHaveBeenCalledWith(call);
    expect(callback).toHaveBeenCalledWith(null, response);
  });

  it('converts the RpcException into a gRPC status', async () => {
    processClinicalRecordStream.mockRejectedValueOnce(
      new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'O primeiro frame deve conter os metadados',
      }),
    );
    const callback = jest.fn();

    controller.saveClinicalRecord(call, callback);
    await new Promise(setImmediate);

    expect(callback).toHaveBeenCalledWith(
      {
        code: status.INVALID_ARGUMENT,
        details: 'O primeiro frame deve conter os metadados',
      },
      null,
    );
  });
});
