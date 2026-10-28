# Pass NestJS

Camada de [SKILL.md](SKILL.md). Aplicar em todo diff que toca módulos, controllers (gRPC/HTTP), services, providers, guards, pipes, filters ou interceptors. Extensão de [llm-smells.md](llm-smells.md).

Regras de implementação de referência: [`nestjs-grpc`](../nestjs-grpc/SKILL.md).

## Instruções

1. **Escopo:** listar os arquivos Nest do diff (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `common/**`).
2. **Módulos:** feature module próprio, imports/exports mínimos, sem ciclo.
3. **DI:** construtor, escopo correto, sem `new`/service locator.
4. **Controllers:** finos, input validado, erro mapeado para o transporte certo.
5. **Services:** responsabilidade única, transação onde precisa, erros de domínio.
6. **Segurança:** guards, validação, nada sensível exposto.
7. **Testes:** service com `TestingModule`, cenários de erro.
8. **Validar achados:** cada Crítico/Obrigatório com `arquivo:linha`, trecho e correção concreta; remover preferência subjetiva.

## Checklist

### Módulos
- [ ] Cada feature tem seu módulo; `AppModule` só compõe.
- [ ] Exporta só o que outro módulo consome.
- [ ] Sem import circular; `forwardRef` justificado em comentário.
- [ ] Provider não registrado em dois módulos (instâncias duplicadas).
- [ ] `@Global()` só para infra transversal.

### Controllers (gRPC e HTTP)
- [ ] Sem lógica de negócio e sem `Repository` injetado.
- [ ] gRPC: `@GrpcMethod`/`@GrpcStreamMethod`/`@GrpcStreamCall` com nome de serviço/método iguais ao proto.
- [ ] gRPC: erros como `RpcException` com status correto (ver [grpc-review.md](grpc-review.md)); HTTP: `HttpException` tipada.
- [ ] HTTP: `ParseUUIDPipe` etc. em params, DTO validado, `@HttpCode` explícito, decorators Swagger.
- [ ] Retorno tipado (`Promise<RecordUploadResponse>`), não `any`.

### Services
- [ ] Uma responsabilidade; sinais de god service (muitos repos, métodos sem relação).
- [ ] Construtor injeta tudo; `Logger` com `Classe.name`.
- [ ] Valores de config via `ConfigService`, nada hardcoded.
- [ ] Erros lançados (não retornados como objeto); sem `catch` que engole.
- [ ] Transação para escrita multi-tabela.

### DTOs e validação
- [ ] DTO com `class-validator` em todo input externo; strings com limite máximo.
- [ ] `ValidationPipe` gera `RpcException(INVALID_ARGUMENT)` em contexto gRPC (não `BadRequestException`).
- [ ] Global pipe vale para gRPC só com `inheritAppConfig: true` — confirmar.
- [ ] Frame de metadata de stream validado manualmente (pipes não validam stream).
- [ ] Resposta não é entity; sem campos internos.

### DI
- [ ] Escopo `REQUEST` só se necessário (propaga custo para dependentes).
- [ ] Singleton sem estado de requisição em campo.
- [ ] Token (`Symbol`) só quando há abstração real com mais de uma implementação.

### Guards, interceptors, filters
- [ ] Guard em todo handler protegido; em RPC usa `switchToRpc().getContext<Metadata>()`.
- [ ] Autorização de papel por decorator + guard, não `if` inline no handler.
- [ ] Interceptors só cross-cutting (log, correlação, timeout), sem regra de negócio.
- [ ] Filter global de exceção RPC registrado; erro desconhecido → `INTERNAL` genérico + log.
- [ ] `@GrpcStreamCall` (callback cru) converte erro manualmente — filter não intercepta.

### Bootstrap (`main.ts` / `app.module.ts`)
- [ ] `connectMicroservice` + `startAllMicroservices` quando há handler gRPC.
- [ ] `enableShutdownHooks` presente.
- [ ] `synchronize: true` fora de dev → **Crítico**.
- [ ] CORS `*`, Swagger público e reflection em produção → sinalizar.
- [ ] `console.log` → `Logger`.

## Anti-patterns (sinalizar)

| ❌ Anti-pattern | Por que | ✅ Correção |
|----------------|---------|------------|
| Fat controller | testabilidade, reuso entre HTTP e gRPC | mover para service |
| `Repository` no controller | acopla transporte à persistência | service intermediário |
| God service | difícil testar e mudar | dividir por responsabilidade |
| `new EmailService()` dentro de service | ignora DI, impossível mockar | injetar |
| Ciclo de módulos | erro de resolução em runtime | módulo compartilhado ou evento |
| `AppModule` monolítico | sem fronteiras | feature modules |
| Over-exporting | acoplamento acidental | exportar só o necessário |
| `catch (e) {}` / log e segue | falha silenciosa | traduzir ou re-lançar |
| `throw new RpcException(error.message)` | vaza detalhe interno | mensagem genérica + log |
| Teste que verifica "chamou X" | testa implementação | testar resultado/erro observável |
| Config hardcoded | ambientes divergentes, segredo no código | `ConfigService` + validação no boot |

## Exemplos

```ts
// ❌ controller gordo, sem validação, erro vazando
@GrpcMethod('ClinicalService', 'GetRecord')
async getRecord(data: any) {
  try {
    return await this.repo.findOne({ where: { id: data.id }, relations: ['patient', 'medicalFiles'] });
  } catch (e) {
    throw new RpcException(e.message);
  }
}

// ✅ fino, tipado, validado, autorizado no service
@GrpcMethod('ClinicalService', 'GetRecord')
getRecord(data: GetRecordRequestDto, metadata: Metadata): Promise<GetRecordResponse> {
  return this.clinicalService.getRecord(data.recordId, userIdFrom(metadata));
}
```

## Output

Template de [SKILL.md](SKILL.md#template-de-output) (`Crítico` / `Obrigatório` / `Sugestão` / `Detalhe` + Pontos positivos).

## Fonte

Adaptado de `nestjs-code-review` (giuseppe-trisciuoglio/developer-kit: SKILL, checklist, patterns, anti-patterns) e `backend-pass` (skills v11).
