import { status } from '@grpc/grpc-js';
import { ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { GrpcExceptionFilter } from './grpc-exception.filter';

const host = {
  getType: () => 'rpc',
  switchToRpc: () => ({ getData: () => ({}), getContext: () => ({}) }),
} as unknown as ArgumentsHost;
const PII_DETAIL =
  'duplicate key value violates unique constraint: Key (document_cpf)=(11144477735) already exists.';

describe('GrpcExceptionFilter', () => {
  const filter = new GrpcExceptionFilter();
  const logError = jest.spyOn(Logger.prototype, 'error');
  const emitted = (exception: unknown) =>
    lastValueFrom(filter.catch(exception, host)).catch(
      (error: unknown) => error,
    );

  beforeEach(() => {
    logError.mockReset();
    logError.mockImplementation(() => undefined);
  });

  afterAll(() => logError.mockRestore());

  it('passes an RpcException through with its code and message', async () => {
    expect(
      await emitted(
        new RpcException({
          code: status.NOT_FOUND,
          message: 'Paciente não encontrado',
        }),
      ),
    ).toEqual({ code: status.NOT_FOUND, message: 'Paciente não encontrado' });
    expect(logError).not.toHaveBeenCalled();
  });

  it('maps a unique violation from the driver to ALREADY_EXISTS', async () => {
    const driverError = Object.assign(new Error(PII_DETAIL), {
      code: '23505',
    });

    expect(
      await emitted(
        new QueryFailedError('INSERT INTO patients ...', [], driverError),
      ),
    ).toEqual({
      code: status.ALREADY_EXISTS,
      message: 'Registro já existente',
    });
  });

  it('maps an error carrying code 23505 to ALREADY_EXISTS', async () => {
    expect(
      await emitted(Object.assign(new Error(PII_DETAIL), { code: '23505' })),
    ).toEqual({
      code: status.ALREADY_EXISTS,
      message: 'Registro já existente',
    });
  });

  it('hides other driver errors as INTERNAL and logs no row values', async () => {
    const driverError = Object.assign(new Error(PII_DETAIL), {
      code: '57P01',
    });

    expect(
      await emitted(
        new QueryFailedError('UPDATE patients ...', [], driverError),
      ),
    ).toEqual({ code: status.INTERNAL, message: 'Erro interno' });
    expect(logError).toHaveBeenCalledWith(
      'Unhandled gRPC error: QueryFailedError 57P01',
    );
  });

  it('hides unknown errors as INTERNAL without logging the message', async () => {
    expect(await emitted(new TypeError(PII_DETAIL))).toEqual({
      code: status.INTERNAL,
      message: 'Erro interno',
    });
    expect(logError).toHaveBeenCalledWith('Unhandled gRPC error: TypeError');
    expect(JSON.stringify(logError.mock.calls)).not.toContain('11144477735');
  });

  it('handles non-Error values as INTERNAL', async () => {
    expect(await emitted('boom')).toEqual({
      code: status.INTERNAL,
      message: 'Erro interno',
    });
    expect(logError).toHaveBeenCalledWith('Unhandled gRPC error: string');
  });

  it.each([undefined, null])(
    'handles a thrown %p as INTERNAL',
    async (value) => {
      expect(await emitted(value)).toEqual({
        code: status.INTERNAL,
        message: 'Erro interno',
      });
    },
  );
});
