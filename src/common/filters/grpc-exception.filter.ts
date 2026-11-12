import { status } from '@grpc/grpc-js';
import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { QueryFailedError } from 'typeorm';

/**
 * Converte qualquer erro de handler gRPC unário em status gRPC com mensagem em PT-BR,
 * sem expor detalhes do driver, SQL ou dados do paciente.
 */
@Catch()
export class GrpcExceptionFilter extends BaseRpcExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  /**
   * Repassa `RpcException`, traduz violação de unicidade e oculta os demais erros.
   *
   * @param exception Erro lançado pelo handler
   * @param host Contexto da chamada
   * @returns Observable com o erro no formato `{ code, message }`
   */
  public override catch(
    exception: unknown,
    host: ArgumentsHost,
  ): Observable<unknown> {
    if (exception instanceof RpcException) {
      return super.catch(exception, host);
    }

    const { code } = ((exception instanceof QueryFailedError
      ? exception.driverError
      : exception) ?? {}) as { code?: string };

    if (code === '23505') {
      return throwError(() => ({
        code: status.ALREADY_EXISTS,
        message: 'Registro já existente',
      }));
    }

    // A message do driver pode ecoar valores da linha (ex.: CPF), por isso só name e code são logados.
    const name = exception instanceof Error ? exception.name : typeof exception;
    this.logger.error(`Unhandled gRPC error: ${name} ${code ?? ''}`.trim());
    return throwError(() => ({
      code: status.INTERNAL,
      message: 'Erro interno',
    }));
  }
}
