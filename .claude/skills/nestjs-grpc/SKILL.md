---
name: nestjs-grpc
description: Implementação NestJS + gRPC + TypeORM no Plexus — proto-first, módulos por feature, client streaming de arquivos, DI, DTO/validação, erros RpcException e TypeORM/PostgreSQL. Use para criar ou alterar .proto, controllers gRPC (@GrpcMethod/@GrpcStreamMethod/@GrpcStreamCall), services, módulos, entities, migrations, guards, pipes, filters e config. Testes ficam na skill test.
---

# NestJS + gRPC (Plexus)

Fonte única de regras de **implementação** do `plexus-api`. O núcleo deste arquivo fica sempre ativo; as camadas irmãs são carregadas pelo roteador conforme a tarefa.

Stack: NestJS 12 (app híbrida HTTP + microservice gRPC), `@grpc/grpc-js`, `@grpc/proto-loader`, `@grpc/reflection`, TypeORM + PostgreSQL, `class-validator`, Swagger (HTTP), Jest, oxlint, Prettier.

Spec do produto: [docs/CONTEXT.md](../../../docs/CONTEXT.md) — RFs, RNFs e modelagem. Leia antes de qualquer feature do domínio clínico.

## Quando usar

- Criar ou alterar `.proto` em `src/proto/` e as interfaces TS que o espelham.
- Criar controllers gRPC (unary ou streaming), services, módulos e providers.
- Criar ou alterar entities, relações, migrations e transações TypeORM.
- Validar input (metadata do stream, DTOs HTTP) e mapear erros para status gRPC.
- Configurar bootstrap (`main.ts`), `ConfigModule`, reflection, health check, shutdown.
- Testes (unit e e2e) ficam na skill [`test`](../test/SKILL.md), obrigatória em todo fix/feature.

## Roteador de camadas

Classifique a tarefa e carregue **apenas** a camada correspondente.

```
Tarefa ou arquivo alterado
        │
        ├─ *.proto, @GrpcMethod, @GrpcStreamMethod/@GrpcStreamCall, upload em chunks,
        │  connectMicroservice, reflection, deadline, health gRPC
        │     → GRPC → grpc-microservices.md
        │
        ├─ *.module.ts, providers, exports, forwardRef, tokens, scope, eventos
        │     → ARQUITETURA_DI → architecture-di.md
        │
        ├─ *.entity.ts, Repository, DataSource, migration, relations, N+1, transação
        │     → BANCO → typeorm-database.md
        │
        ├─ dto/*.ts, class-validator, ValidationPipe, serialização, controller HTTP/Swagger
        │     → DTO_VALIDACAO → dto-validation.md
        │
        ├─ RpcException, exception filter, Logger, ConfigModule, shutdown, async errors
        │     → ERROS_OBS → errors-observability.md
        │
        └─ auth via metadata, guards/interceptors em RPC, rate limit, CORS, headers
              → SEGURANCA → security-auth.md
```

`*.spec.ts`, `test/*.e2e-spec.ts`, mocks e `TestingModule` → skill [`test`](../test/SKILL.md).

| Camada | Sinais | Arquivo |
|--------|--------|---------|
| gRPC | proto, streaming, `RpcException`, reflection, `maxReceiveMessageLength` | [grpc-microservices.md](grpc-microservices.md) |
| Arquitetura e DI | módulos, `exports`, ciclo de import, `Scope.REQUEST`, tokens | [architecture-di.md](architecture-di.md) |
| Banco (TypeORM) | entity, `relations`, migration, `DataSource.transaction`, índice | [typeorm-database.md](typeorm-database.md) |
| DTO e validação | `class-validator`, pipes, response DTO, Swagger | [dto-validation.md](dto-validation.md) |
| Erros e observabilidade | filters, logging sem PII, config, shutdown | [errors-observability.md](errors-observability.md) |
| Segurança e auth | metadata `authorization`, guards, throttling | [security-auth.md](security-auth.md) |

## Workflow obrigatório

1. Ler a spec ([docs/CONTEXT.md](../../../docs/CONTEXT.md)) e traçar o fluxo **proto → controller → service → repository/entity → disco/banco**.
2. Mapear o que é afetado: `.proto`, interfaces em `interfaces/`, DTOs, entities, módulo, `main.ts`/`app.module.ts`, testes.
3. Antes de criar provider, helper ou abstração: buscar algo existente em `src/` (`grep` por nome de domínio, `@Injectable`, `common/`).
4. Se o `.proto` muda: verificar compatibilidade (nunca renumerar ou reaproveitar field number; campo removido vira `reserved`). Detalhe em [grpc-microservices.md](grpc-microservices.md).
5. Identificar impacto em dados sensíveis (CPF, notas clínicas, arquivos médicos): o que é logado, persistido e devolvido.
6. Apresentar plano de implementação e testes antes de editar código.
7. Implementar de forma incremental; rodar validação (abaixo) e chamar [`review`](../review/SKILL.md) antes de concluir.

## Código enxuto: onde implementar

> **Princípio:** NestJS já fornece módulos, DI, pipes, guards, filters e interceptors; TypeORM já fornece Repository e QueryBuilder. KISS antes de abstração.

| Prioridade | Onde | Exemplos |
|------------|------|----------|
| 1 | **Contrato proto** | mensagem, `oneof`, tipos corretos (`int64`, `bytes`) — o contrato decide a forma |
| 2 | **Entity** | colunas, `unique`, `onDelete`, índices, tipos (`uuid`, `timestamptz`, `bigint`) |
| 3 | **Repository TypeORM** | `findOne`, `exists`, `QueryBuilder` parametrizado, `manager` da transação |
| 4 | **Service** | regra de negócio, orquestração de transação e de I/O (disco) |
| 5 | **Controller gRPC/HTTP** | fino: adapta transporte → service, mapeia erro |
| 6 | **Provider/helper novo** | **último recurso:** 2+ usos com contrato estável, I/O externo, cross-cutting (`common/`) |

**Anti-padrões**

- Custom repository que só repassa `this.repo.findOne(...)`.
- `utils.ts` ou constante de módulo para algo usado uma vez.
- Lógica de negócio no controller; acesso a `Repository` direto no controller.
- Interface + token + implementação única "para o futuro" (generalidade especulativa).
- Carregar o arquivo inteiro em memória (`Buffer.concat` de todos os chunks) — viola RNF02.

## Convenções do projeto

- **Proto-first:** `src/proto/*.proto` é o contrato. Interfaces em `src/modules/<feature>/interfaces/` espelham as mensagens em **camelCase** (loader com `keepCase: false`). Mudou o proto → muda a interface no mesmo commit.
- **Package versionado:** `package plexus.<dominio>.v1;` Breaking change → `v2`, não editar `v1` incompatível.
- **Estrutura por feature:** `src/modules/<feature>/{entities,interfaces,dto}/`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.module.ts`. Cross-cutting em `src/common/{filters,guards,interceptors,pipes}`.
- **Nomes de funções em inglês** (RNF04): `streamExamToDisk`, `saveClinicalRecord`. Comentários e docs podem ser PT-BR.
- **DI por construtor** sempre (`private readonly`); nunca `new` em `@Injectable`.
- **Config** via `ConfigService` (nunca `process.env` espalhado); valores sensíveis só em `.env`.
- **TypeScript `strict`**: sem `any` (use `unknown` + narrowing), sem `!` para calar o compilador fora de entity.
- **Prettier:** aspas simples, `trailingComma: all`. **Lint:** `oxlint --type-aware`.
- **Persistência de arquivo** (RNF03): banco guarda metadados + caminho; binário vai para disco via stream.
- Docstring JSDoc curta em classe/método público quando o "porquê" não é óbvio; sem comentário narrando código.

## Erros gRPC (núcleo)

Lançar `RpcException` com status do `@grpc/grpc-js`; nunca devolver stack trace, SQL ou path interno.

| Situação | `status` |
|----------|----------|
| Input inválido / primeiro frame sem `metadata` / chunk antes de metadata | `INVALID_ARGUMENT` |
| Recurso não existe ou fora do escopo do caller | `NOT_FOUND` |
| CPF já cadastrado (violação de unique) | `ALREADY_EXISTS` |
| Sem credencial / credencial inválida | `UNAUTHENTICATED` |
| Autenticado sem permissão | `PERMISSION_DENIED` |
| Arquivo acima do limite (100MB) | `RESOURCE_EXHAUSTED` ou `INVALID_ARGUMENT` (documentar a escolha) |
| Estado de domínio impede a operação | `FAILED_PRECONDITION` |
| Falha inesperada | `INTERNAL` (mensagem genérica, detalhe só no log) |

```ts
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'First frame must be metadata' });
```

## Dados sensíveis (núcleo)

CPF, telefone, notas clínicas e arquivos médicos são **dados pessoais sensíveis (saúde — LGPD Art. 11)**.

- Nunca logar CPF, notas, nome completo ou conteúdo de arquivo; logar `recordId`/`patientId`.
- Respostas devolvem só o necessário (ex.: `recordId`, `totalBytes`), nunca a entity inteira.
- `disk_path` é interno: não devolver path absoluto se não for requisito explícito.
- Revisão obrigatória: [review/lgpd.md](../review/lgpd.md).

## Validação antes de concluir

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run test:e2e   # quando tocar controller/bootstrap/proto
npm run build      # confirma que o .proto foi copiado para dist (nest-cli assets)
```

Nunca concluir com lint, typecheck ou testes falhando no escopo alterado.

## Quando chamar outra skill

| Situação | Carregar |
|----------|----------|
| Todo fix ou feature (teste de regressão obrigatório) | [`test`](../test/SKILL.md) — [scenarios.md](../test/scenarios.md) |
| Antes de concluir feature/fix, PR ou "revisa isso" | [`review`](../review/SKILL.md) — [quality-gate.md](../review/quality-gate.md) |
| Mudança em `.proto` com cliente existente | [review/grpc-review.md](../review/grpc-review.md) (compatibilidade) |
| CPF, dados de saúde, arquivo médico, logs | [review/lgpd.md](../review/lgpd.md) |
| Upload, auth, segredo, CORS | [review/security-hardening.md](../review/security-hardening.md) |
| Gerar mensagem de commit | comando `/commit` |

## Fontes

Sintetizado e adaptado (MIT) de:
- `nestjs-best-practices` — Kadajett, [github.com/kadajett/agent-nestjs-skills](https://github.com/kadajett/agent-nestjs-skills)
- `nestjs-patterns` — ECC, [github.com/affaan-m/ecc](https://github.com/affaan-m/ecc)
- `nestjs-expert` — Jeffallan, [github.com/jeffallan/claude-skills](https://github.com/jeffallan/claude-skills)
- Estrutura de orquestrador inspirada em `django-expert` (skills v11).
