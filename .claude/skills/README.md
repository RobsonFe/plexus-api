# Skills de agente (Plexus API)

Skills do Claude Code para o `plexus-api` (NestJS + gRPC + TypeORM/PostgreSQL). Cada skill é uma pasta com um `SKILL.md` **orquestrador**: um núcleo sempre ativo e um roteador que carrega só a camada `*.md` necessária para a tarefa.

| Skill | Pasta | Papel |
|-------|-------|-------|
| `nestjs-grpc` | [nestjs-grpc/](./nestjs-grpc/SKILL.md) | **Implementação**: proto, gRPC streaming, módulos, DI, TypeORM, DTOs, erros, segurança |
| `test` | [test/](./test/SKILL.md) | **Testes**: regressão obrigatória, matriz de cenários, TDD, testes honestos, cobertura, unit NestJS, gRPC/e2e |
| `review` | [review/](./review/SKILL.md) | **Revisão**: quality gate, smells LLM, NestJS, gRPC, segurança, LGPD, performance, concorrência, dois eixos, TypeScript |
| `/commit` | [../commands/commit.md](../commands/commit.md) | Comando: gera mensagem de commit (Conventional Commits, PT-BR) a partir do staged |

Spec do produto (RF/RNF): [docs/CONTEXT.md](../../docs/CONTEXT.md).

**Princípio transversal:** código mais limpo, legível e enxuto possível (KISS), sem helpers ou funções auxiliares desnecessárias; camadas Controller → Service → Repository → Mapper. Detalhe em [plexus-rules.md](../rules/plexus-rules.md).

## Amarração Rules ↔ Skills

| Camada | Arquivo |
|--------|---------|
| Instruções do agente (carregadas via `CLAUDE.md`) | [AGENTS.md](../AGENTS.md) |
| Regras sempre ativas | [rules/plexus-rules.md](../rules/plexus-rules.md) |
| Portão de qualidade | [rules/backend-quality-gate.md](../rules/backend-quality-gate.md) |

As rules definem **o que** é obrigatório (workflow, camadas, KISS, naming, padrão de resposta gRPC); as skills detalham **como** fazer, sem duplicar a rule.

## Origem

- `nestjs-grpc` une `nestjs-best-practices` (kadajett), `nestjs-patterns` (affaan-m/ecc) e `nestjs-expert` (jeffallan), adaptadas para gRPC + TypeORM.
- `review` une a `review` das skills v11 (adaptada de Django para NestJS), `code-review` (Matt Pocock) e `nestjs-code-review` (giuseppe-trisciuoglio).
- `test` é a `test` das skills v11 adaptada de pytest/DRF para Jest/NestJS/gRPC.
- As skills originais **não** ficam instaladas separadamente: invoque só `nestjs-grpc`, `test` ou `review`.

## Camadas de `nestjs-grpc`

| Camada | Arquivo |
|--------|---------|
| gRPC, proto, streaming de upload | [grpc-microservices.md](./nestjs-grpc/grpc-microservices.md) |
| Módulos e injeção de dependência | [architecture-di.md](./nestjs-grpc/architecture-di.md) |
| TypeORM, migrations, transações | [typeorm-database.md](./nestjs-grpc/typeorm-database.md) |
| DTOs, validação, respostas | [dto-validation.md](./nestjs-grpc/dto-validation.md) |
| Erros, logging, config, shutdown | [errors-observability.md](./nestjs-grpc/errors-observability.md) |
| Auth, guards, rate limit, upload seguro | [security-auth.md](./nestjs-grpc/security-auth.md) |

## Camadas de `test`

| Camada | Arquivo |
|--------|---------|
| Matriz feliz/erro (obrigatória em fix/feature) | [scenarios.md](./test/scenarios.md) |
| TDD | [tdd.md](./test/tdd.md) |
| Testes honestos / mutação | [good-tests.md](./test/good-tests.md) |
| Cobertura (comportamento > %) | [coverage.md](./test/coverage.md) |
| Unit NestJS (TestingModule, mocks, disco) | [nest-unit.md](./test/nest-unit.md) |
| gRPC (stream falso, status, e2e) | [grpc.md](./test/grpc.md) |
| Exemplos | [examples.md](./test/examples.md) |

## Camadas de `review`

| Camada | Arquivo |
|--------|---------|
| Quality gate pré-merge | [quality-gate.md](./review/quality-gate.md) |
| Smells LLM | [llm-smells.md](./review/llm-smells.md) |
| Pass NestJS | [nestjs-pass.md](./review/nestjs-pass.md) |
| Contrato e streaming gRPC | [grpc-review.md](./review/grpc-review.md) |
| Segurança / hardening | [security-hardening.md](./review/security-hardening.md) |
| LGPD (dados de saúde) | [lgpd.md](./review/lgpd.md) · [lgpd-reference.md](./review/lgpd-reference.md) |
| Performance TypeORM | [typeorm-perf.md](./review/typeorm-perf.md) |
| Concorrência e transações | [concurrency-review.md](./review/concurrency-review.md) |
| Dois eixos (Padrões/Spec) | [two-axis-review.md](./review/two-axis-review.md) |
| TypeScript | [typescript-review.md](./review/typescript-review.md) |

## Handoff entre skills

| Skill primária | Também carregar quando |
|----------------|------------------------|
| `nestjs-grpc` | fix/feature → `test` ([scenarios.md](./test/scenarios.md)); antes de concluir → `review` ([quality-gate.md](./review/quality-gate.md)); mudou `.proto` → [grpc-review.md](./review/grpc-review.md); dado de paciente → [lgpd.md](./review/lgpd.md); commitar → `/commit` |
| `test` | contrato/DI/erro esperado → `nestjs-grpc`; pré-merge → `review`; corrida/CPF duplicado → [concurrency-review.md](./review/concurrency-review.md) |
| `review` | corrigir achado → `nestjs-grpc` (camada correspondente); teste de regressão → `test`; review verde → `/commit` |

**Pré-merge:** `review` quality gate + `test` verde no escopo (`npm run lint`, `npx tsc --noEmit`, `npm test`).

## Invocar no chat

| Objetivo | Comando |
|----------|---------|
| Implementar feature/fix NestJS ou gRPC | `/nestjs-grpc [tarefa]` |
| Escrever testes / regressão (obrigatório em fix/feature) | `/test [alvo]` |
| Revisar staged / branch / PR | `/review [staged \| desde main \| PR #n]` |
| Revisão Padrões vs Spec desde um ponto | `/review desde <ref>` (camada dois eixos) |
| Gerar mensagem de commit | `/commit` |

O Claude também carrega as skills automaticamente quando o pedido combina com a `description` do `SKILL.md`.
