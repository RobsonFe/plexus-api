# Erros, logging, config e ciclo de vida

Camada de [SKILL.md](SKILL.md). Carregar ao tratar exceções, criar filters, logar, configurar env ou shutdown.

Referência: [docs.nestjs.com/microservices/exception-filters](https://docs.nestjs.com/microservices/exception-filters) · [docs.nestjs.com/techniques/configuration](https://docs.nestjs.com/techniques/configuration)

## 1. Lançar, não retornar erro

Services lançam exceções; não retornam `{ error: ... }` nem `null` silencioso para o controller decidir.

- Domínio gRPC: `RpcException({ code, message })` com status de `@grpc/grpc-js` e mensagem em **PT-BR** (tabela no [SKILL.md](SKILL.md#erros-grpc-núcleo)).
- Logs técnicos (`Logger`) podem ficar em inglês; o que chega ao cliente é PT-BR.
- Domínio HTTP: `HttpException` tipadas.
- Se o mesmo service atende os dois transportes, lance **erros de domínio** (`PatientNotFoundError extends Error`) e traduza em um filter por transporte.

## 2. Exception filter RPC

Centraliza: erro conhecido → status gRPC; desconhecido → `INTERNAL` genérico + log completo.

```ts
@Catch()
export class GrpcExceptionFilter extends BaseRpcExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) return super.catch(exception, host);
    if (exception instanceof QueryFailedError && (exception as { code?: string }).code === '23505') {
      return throwError(() => ({ code: status.ALREADY_EXISTS, message: 'Registro já existente' }));
    }
    this.logger.error('Unhandled gRPC error', exception instanceof Error ? exception.stack : undefined);
    return throwError(() => ({ code: status.INTERNAL, message: 'Erro interno' }));
  }
}
```

- Registrar com `app.useGlobalFilters(...)` + `inheritAppConfig: true`, ou `@UseFilters()` no controller gRPC.
- Para `@GrpcStreamCall` (callback cru), o filter **não** intercepta: converta no controller (`callback(toGrpcError(err))`). `toGrpcError` em `common/` é justificada porque filter e controller a usam (2 usos); com um só uso, ficaria inline.
- Nunca colocar `error.message` de driver/SQL na mensagem ao cliente.

## 3. Erros assíncronos

- Toda Promise é `await`ada ou tem `.catch` explícito. Sem fire-and-forget silencioso.
- Callbacks de stream (`on('error')`, `on('data')`) não podem lançar sem tratamento — derrubam o processo.
- `try/catch` só onde há recuperação ou tradução real; não envolva tudo em `catch (e) { throw e }`.
- Em `catch` que precisa limpar recurso (arquivo temporário), limpe e **re-lance**.

## 4. Logging estruturado sem PII

- `Logger` do Nest com contexto (`new Logger(ClinicalService.name)`); nunca `console.log` (o `main.ts` atual usa — trocar por `Logger`).
- Logar IDs (`recordId`, `patientId`, `requestId`), duração, tamanho em bytes, status gRPC.
- **Nunca** logar: CPF, nome, telefone, `doctorNotes`, conteúdo de chunk, token, `.env`.
- Correlação: propagar `x-request-id` da metadata gRPC (interceptor) para os logs.
- `@nestjs/observe` já está no `AppModule`; `appKey`/`appSecret` devem vir do `ConfigService`, não hardcoded.

## 5. Configuração

- `ConfigModule.forRoot({ isGlobal: true, validate })` com validação no boot (class-validator ou schema) — falhar ao subir se faltar `DB_*`, `GRPC_URL`, `STORAGE_DIR`.
- Acesso tipado: `config.getOrThrow<string>('STORAGE_DIR')`.
- Sem defaults de credencial para produção (`DB_PASSWORD` default `'plexus'` só serve para dev local).
- Novas variáveis: documentar em `.env.example` (sem valores reais).

## 6. Graceful shutdown

```ts
app.enableShutdownHooks();
```

- `onApplicationShutdown` fecha recursos próprios (streams, clients).
- Uploads em andamento no shutdown: abortar e limpar temporários; nunca deixar registro `uploading` órfão sem rotina de limpeza.

## Fonte

Adaptado de `error-use-exception-filters`, `error-throw-http-exceptions`, `error-handle-async-errors`, `devops-use-logging`, `devops-use-config-module`, `devops-graceful-shutdown` (kadajett/agent-nestjs-skills) e `nestjs-patterns` (affaan-m/ecc).
