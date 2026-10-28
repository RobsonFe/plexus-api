---
name: nestjs-grpc
description: Implementação NestJS + gRPC + TypeORM no Plexus com código enxuto (KISS) — proto-first, camadas Controller → Service → Repository → Mapper, client streaming de arquivos, DI, DTO/validação, erros RpcException em PT-BR e TypeORM/PostgreSQL. Use para criar ou alterar .proto, controllers gRPC (@GrpcMethod/@GrpcStreamMethod/@GrpcStreamCall), services, repositories, mappers, módulos, entities, migrations, guards, pipes, filters e config. Testes ficam na skill test.
---

# NestJS + gRPC (Plexus)

Fonte única de regras de **implementação** do `plexus-api`. O núcleo deste arquivo fica sempre ativo; as camadas irmãs são carregadas pelo roteador conforme a tarefa. Regras obrigatórias do projeto: [plexus-rules.md](../../rules/plexus-rules.md) — esta skill detalha **como** cumpri-las.

Stack: NestJS 12 (app híbrida HTTP + microservice gRPC), `@grpc/grpc-js`, `@grpc/proto-loader`, `@grpc/reflection`, TypeORM + PostgreSQL, `class-validator`, Jest, oxlint, Prettier.

Spec do produto: [docs/CONTEXT.md](../../../docs/CONTEXT.md) — RFs, RNFs e modelagem. Leia antes de qualquer feature do domínio clínico.

## Princípio: código enxuto (KISS)

> Gerar **sempre** o código mais limpo, legível e enxuto que resolve o problema. NestJS já fornece módulos, DI, pipes, guards e filters; TypeORM já fornece Repository e QueryBuilder; Node já fornece streams. **Use o que existe antes de escrever código novo.**

- Helper, função auxiliar, `utils.ts`, wrapper ou constante: só com **2+ usos reais** ou I/O externo. Uso único fica **inline** no método.
- Sem abstração especulativa (interface/token/factory "para o futuro", parâmetro que ninguém passa).
- As camadas Controller → Service → Repository → Mapper são a **única** estrutura obrigatória. Dentro delas, código direto.
- Na dúvida entre extrair e deixar inline: **deixe inline**.

**Ruim — helper de uso único + constante solta + loop manual**

```ts
const MAX_NAME = 255;

function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME;
}

function sumChunkSizes(chunks: FileChunk[]): number {
  let total = 0;
  for (const c of chunks) total += c.data.length;
  return total;
}
```

**Bom — validação declarativa no DTO e contagem direta no fluxo do stream**

```ts
export class ClinicalMetadataDto {
  @Length(1, 255) patientFullName: string;
}

totalBytes += frame.chunk.data.length;
if (totalBytes > this.maxBytes) throw new RpcException({ code: status.RESOURCE_EXHAUSTED, message: 'Arquivo excede o limite de 100MB' });
```

**Ruim — wrapper que só repassa**

```ts
async findPatient(id: string) { return this.patientRepository.findById(id); } // no service, sem regra
```

**Bom —** o controller/service chama o método de domínio do repository direto; o wrapper não existe.

## Quando usar

- Criar ou alterar `.proto` em `src/proto/` e as interfaces TS que o espelham.
- Criar controllers gRPC (unary ou streaming), services, repositories, mappers, módulos e providers.
- Criar ou alterar entities, relações, migrations e transações TypeORM.
- Validar input (metadata do stream, DTOs) e mapear erros para status gRPC.
- Configurar bootstrap (`main.ts`), `ConfigModule`, reflection, health check, shutdown.
- Testes (unit e e2e) ficam na skill [`test`](../test/SKILL.md), obrigatória em todo fix/feature.

## Roteador de camadas

Classifique a tarefa e carregue **apenas** a camada correspondente.

```
Tarefa ou arquivo alterado
        │
        ├─ *.proto, @GrpcMethod, @GrpcStreamMethod/@GrpcStreamCall, upload em chunks,
        │  result/results/PageMeta, connectMicroservice, reflection, deadline, health gRPC
        │     → GRPC → grpc-microservices.md
        │
        ├─ *.module.ts, estrutura de pastas, camadas, providers, exports, forwardRef, tokens, scope
        │     → ARQUITETURA_DI → architecture-di.md
        │
        ├─ *.entity.ts, repository/, mapper/, DataSource, migration, relations, N+1, transação
        │     → BANCO → typeorm-database.md
        │
        ├─ dto/*.ts, class-validator, ValidationPipe, mensagens de validação
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
| gRPC | proto, streaming, envelope `result`/`results`, reflection | [grpc-microservices.md](grpc-microservices.md) |
| Arquitetura e DI | pastas, camadas, `exports`, ciclo de import, tokens | [architecture-di.md](architecture-di.md) |
| Banco (TypeORM) | entity, repository, mapper, transação, índice | [typeorm-database.md](typeorm-database.md) |
| DTO e validação | `class-validator`, pipes, mensagens PT-BR | [dto-validation.md](dto-validation.md) |
| Erros e observabilidade | filters, logging sem PII, config, shutdown | [errors-observability.md](errors-observability.md) |
| Segurança e auth | metadata `authorization`, guards, throttling | [security-auth.md](security-auth.md) |

## Workflow obrigatório

1. Ler a spec ([docs/CONTEXT.md](../../../docs/CONTEXT.md)) e traçar o fluxo **proto → controller → service → repository/mapper → banco/disco**.
2. Mapear o que é afetado: `.proto`, interfaces, DTOs, entities, repository, mapper, módulo, `main.ts`/`app.module.ts`, testes.
3. Antes de criar provider, helper ou abstração: buscar algo existente em `src/` (Grep por nome de domínio, `@Injectable`, `common/`). Não encontrou e é uso único? Escreva inline.
4. Se o `.proto` muda: verificar compatibilidade (nunca renumerar ou reaproveitar field number; campo removido vira `reserved`). Detalhe em [grpc-microservices.md](grpc-microservices.md).
5. Identificar impacto em dados sensíveis (CPF, notas clínicas, arquivos médicos): o que é logado, persistido e devolvido.
6. Apresentar plano de implementação e testes antes de editar código.
7. Implementar de forma incremental; rodar validação (abaixo), [`test`](../test/SKILL.md) e [`review`](../review/SKILL.md) antes de concluir.

## Onde implementar (camadas)

| Camada | Pasta | Faz | Não faz |
|--------|-------|-----|---------|
| **Contrato** | `src/proto/` + `interfaces/` | define mensagens, `oneof`, `result`/`results` | — |
| **Entity** | `entities/` | colunas, `unique`, `onDelete`, índices (decorators TypeORM) | lógica de infraestrutura |
| **Repository** | `repository/` | queries, transações, N+1, upsert/lock — **único** que importa `typeorm` | regra de negócio |
| **Mapper** | `mapper/` | entity → mensagem proto; `bigint`/datas; remove campos sensíveis | I/O, regra |
| **Service** | `service/` | regra de negócio, orquestração, I/O de disco, `RpcException` | importar TypeORM, `process.env` |
| **Controller** | `controller/` | `@Grpc*`, guards, pipe, delega | regra, banco, try/catch desnecessário |
| **Helper/provider extra** | `common/` ou módulo | **último recurso:** 2+ usos com contrato estável ou I/O externo | uso único |

**Anti-padrões**

- Helper, `utils.ts`, wrapper ou constante de uso único.
- Service importando `typeorm`, `Repository<T>`, `DataSource` ou `@InjectRepository`.
- Repository com regra de negócio ou CRUD genérico que só repassa `find`.
- Entity TypeORM saindo do service para o controller (sempre via mapper).
- Interface + token + implementação única "para o futuro".
- Carregar o arquivo inteiro em memória (`Buffer.concat` de todos os chunks) — viola RNF02.

## Convenções do projeto

- **Proto-first:** `src/proto/*.proto` é o contrato. Interfaces em `interfaces/` espelham as mensagens em **camelCase** (loader com `keepCase: false`). Mudou o proto → muda a interface no mesmo commit.
- **Package versionado:** `package plexus.<dominio>.v1;` Breaking change → `v2`.
- **Estrutura por módulo:** `controller/`, `service/`, `repository/`, `mapper/`, `dto/`, `entities/`, `interfaces/`, `test/`, `<feature>.module.ts`; `validation/`, `constants/`, `contracts/` só quando tiverem conteúdo real. Ver [architecture-di.md](architecture-di.md).
- **Idioma:** código, nomes e testes em inglês (RNF04: `streamExamToDisk`, `saveClinicalRecord`); mensagens ao usuário e comentários em **PT-BR**.
- **JSDoc obrigatório** em métodos públicos de service, repository e mapper e em funções exportadas (`@param`, `@returns`, `@throws`). Comentário inline só para decisão não óbvia, workaround ou limitação externa.
- **Métodos** < 30 linhas (ideal), 50 no máximo; guard clauses em vez de aninhamento.
- **DI por construtor** sempre (`private readonly`); nunca `new` em `@Injectable`.
- **Config** via `ConfigService` (nunca `process.env` espalhado).
- **TypeScript `strict`**: sem `any` (use `unknown` + narrowing).
- **Prettier:** aspas simples, `trailingComma: all`. **Lint:** `oxlint --type-aware`.
- **Persistência de arquivo** (RNF03): banco guarda metadados + caminho; binário vai para disco via stream.

## Erros gRPC (núcleo)

Lançar `RpcException` com status do `@grpc/grpc-js` e **mensagem em PT-BR**; nunca devolver stack trace, SQL ou path interno.

| Situação | `status` | Mensagem (exemplo) |
|----------|----------|--------------------|
| Input inválido / primeiro frame sem `metadata` / chunk antes de metadata | `INVALID_ARGUMENT` | `O primeiro frame deve conter os metadados` |
| Recurso não existe ou fora do escopo do caller | `NOT_FOUND` | `Prontuário não encontrado` |
| CPF já cadastrado (violação de unique) | `ALREADY_EXISTS` | `Paciente já cadastrado` |
| Sem credencial / credencial inválida | `UNAUTHENTICATED` | `Credenciais ausentes ou inválidas` |
| Autenticado sem permissão | `PERMISSION_DENIED` | `Acesso negado` |
| Arquivo acima do limite (100MB) | `RESOURCE_EXHAUSTED` | `Arquivo excede o limite de 100MB` |
| Estado de domínio impede a operação | `FAILED_PRECONDITION` | `Operação não permitida no estado atual` |
| Falha inesperada | `INTERNAL` | `Erro interno` (detalhe só no log) |

```ts
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'O primeiro frame deve conter os metadados' });
```

## Dados sensíveis (núcleo)

CPF, telefone, notas clínicas e arquivos médicos são **dados pessoais sensíveis (saúde — LGPD Art. 11)**.

- Nunca logar CPF, notas, nome completo ou conteúdo de arquivo; logar `recordId`/`patientId`.
- Respostas devolvem só o necessário — o mapper decide os campos; nunca a entity inteira.
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
- Estrutura de orquestrador e princípio de código enxuto inspirados em `django-expert` (skills v11).
