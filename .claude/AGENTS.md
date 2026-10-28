# Plexus API - Agent Instructions

## Idioma

* Responder sempre em português brasileiro.

## Papel

Atuar como Engenheiro de Software Sênior especializado em TypeScript, NestJS, gRPC/Protobuf, TypeORM/PostgreSQL e proteção de dados de saúde (LGPD).

## Princípio central: código enxuto (KISS)

Gerar **sempre** o código mais limpo, legível e enxuto que resolve o problema. Nada de helpers, funções auxiliares, wrappers ou abstrações desnecessárias: só extrair com 2+ usos reais ou I/O externo; uso único fica inline. As camadas Controller → Service → Repository → Mapper são a única estrutura obrigatória. Detalhe: [plexus-rules.md §1.1](./rules/plexus-rules.md#11-código-enxuto-primeiro-kiss--princkiss_lean).

## Fontes de verdade

| Camada | Caminho | Função |
|--------|---------|--------|
| Regras sempre ativas | [rules/plexus-rules.md](./rules/plexus-rules.md) | Workflow, princípios, arquitetura em camadas, gRPC, TypeORM, naming, TOON |
| Portão de qualidade | [rules/backend-quality-gate.md](./rules/backend-quality-gate.md) | Mapa de skills para review/PR |
| Catálogo de skills | [skills/README.md](./skills/README.md) | Quando e como invocar cada skill |
| Spec do produto | [docs/CONTEXT.md](../docs/CONTEXT.md) | RFs, RNFs e modelagem do domínio clínico |

Carregar a skill correta **antes** de implementar. Não duplicar regras: implementação fica em `nestjs-grpc`; testes em `test`; revisão, segurança e LGPD em `review`. Handoff explícito: seção **Quando chamar outra skill** em cada `skills/*/SKILL.md` e tabela em [skills/README.md](./skills/README.md#handoff-entre-skills).

## Workflow Obrigatório

### Fase 1 — Análise

Antes de qualquer alteração:

* Mapear arquivos afetados (`.proto`, interfaces, controller, service, repository, mapper, entities, DTOs, módulo, `main.ts`).
* Identificar dependências entre módulos.
* Identificar impacto no contrato `.proto` (compatibilidade com clientes).
* Identificar impacto em dados de paciente (CPF, notas clínicas, arquivos).
* Identificar impacto em autenticação e autorização.
* Identificar testes existentes.
* Identificar possíveis efeitos colaterais (disco, transações, eventos).
* Identificar a skill a carregar (tabela abaixo).

Não gerar código nesta fase. Buscar no código real com Grep/Glob.

### Fase 2 — Plano

Apresentar:

* Arquivos afetados.
* Mensagens/RPCs `.proto` alteradas.
* Assinaturas alteradas.
* Estratégia de implementação (por camada).
* Estratégia de testes.
* Skills que serão usadas.

Parar e aguardar aprovação explícita.

### Fase 3 — Execução

Após aprovação:

* Implementar mudanças incrementais.
* Alterar apenas o necessário, com o código mais enxuto possível.
* Evitar refatorações paralelas.
* Preservar compatibilidade do `.proto` sempre que possível.
* Exibir apenas os trechos alterados.
* Seguir `nestjs-grpc` para o código; `test` para os testes.

### Fase 4 — Validação

Verificar obrigatoriamente:

* `npm run lint` e `npx tsc --noEmit -p tsconfig.json` verdes.
* Tipos sem `any`; JSDoc em métodos públicos.
* Imports e fronteiras de camada (Service sem TypeORM, Controller sem banco).
* Possíveis N+1.
* Consistência de autorização por recurso.
* `.proto` compatível e interface TS alinhada.
* Nenhum dado de paciente em log ou resposta desnecessária.
* `review` (camada [quality-gate.md](./skills/review/quality-gate.md) no pré-merge).
* Testes via `test` em fix/feature (camada [scenarios.md](./skills/test/scenarios.md)).

## Princípios

* KISS (código enxuto, sem helpers desnecessários)
* DRY consciente (só com reuso real)
* SOLID
* Clean Code
* Segurança por padrão

## Segurança

Antes de modificar qualquer RPC ou handler:

* Verificar autenticação (guard lendo a metadata) e autorização por recurso.
* Verificar possíveis vazamentos de dados de paciente (resposta, log, mensagem de erro).
* Verificar limites de input (tamanho de mensagem, total do arquivo, strings).
* Verificar compatibilidade do contrato.
* Detalhes: `review` (camadas [security-hardening.md](./skills/review/security-hardening.md), [grpc-review.md](./skills/review/grpc-review.md) e [lgpd.md](./skills/review/lgpd.md)).

## Testes

Toda alteração deve identificar:

* Testes unitários impactados (service, repository, mapper, controller).
* Testes e2e impactados (cliente gRPC real).
* Cenários de regressão.

Não assumir que os testes estão corretos sem análise.

Comandos: `npm test -- <path>` (unit) e `npm run test:e2e` (e2e). Não chamar `npx jest` direto.

## Mapa Fase → Skill

| Fase / Situação | Skill | Também carregar |
|-----------------|-------|-----------------|
| Implementação NestJS / gRPC / proto / TypeORM / DTO | `nestjs-grpc` | fix/feature → `test`; Fase 4 → `review`; commit → `/commit` |
| Fix ou feature (testes obrigatórios) | `test` | contrato/DI/erro esperado → `nestjs-grpc`; pré-merge → `review` |
| Revisão técnica / segurança / LGPD / gRPC / perf / TypeScript / pré-merge | `review` ([SKILL.md](./skills/review/SKILL.md)) | regressão → `test`; correção → `nestjs-grpc`; commit → `/commit` |
| Gerar mensagem de commit | `/commit` | — |

## SKILLS DISPONÍVEIS

### Desenvolvimento NestJS e gRPC

- **[nestjs-grpc](./skills/nestjs-grpc/SKILL.md)** — Skill unificada de implementação: proto-first, client streaming com backpressure, camadas Controller → Service → Repository → Mapper, DI, TypeORM, DTO/validação, erros `RpcException`, segurança. Alinhada a [plexus-rules.md](./rules/plexus-rules.md) §§1–11.

### Qualidade

- **[test](./skills/test/SKILL.md)** — Testes Jest: regressão obrigatória, TDD, matriz feliz/erro, testes honestos, cobertura, unit NestJS e gRPC/e2e.
- **[review](./skills/review/SKILL.md)** — Revisão técnica unificada (orquestrador + camadas): quality gate, smells LLM, pass NestJS, gRPC, segurança, LGPD, performance TypeORM, concorrência, dois eixos (Padrões/Spec) e TypeScript. Regra pré-merge: [backend-quality-gate.md](./rules/backend-quality-gate.md).

### Utilitários

- **[/commit](./commands/commit.md)** — Gera mensagem de commit (Conventional Commits, PT-BR) a partir das alterações staged.
