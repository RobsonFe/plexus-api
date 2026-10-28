---
name: test
description: Testes Jest no Plexus (NestJS + gRPC + TypeORM) — regressão obrigatória, TDD, testes honestos (anti-falso-positivo), matriz de cenários feliz/erro, cobertura com sentido, unit com TestingModule, stream gRPC falso e e2e com cliente gRPC real. Use em fix, feature, validação, upload por streaming, autorização e antes de concluir PR.
---

# Test

Skill orquestradora de testes do `plexus-api`. O núcleo abaixo é **sempre ativo**; carregue camadas conforme o roteador.

Stack: Jest 30 + `ts-jest`, `@nestjs/testing`, `supertest` (HTTP), `@grpc/grpc-js` + `@grpc/proto-loader` (cliente gRPC em e2e). Unit em `src/**/*.spec.ts` (`jest.config.ts`); e2e em `test/**/*.e2e-spec.ts` (`test/jest-e2e.json`).

## Quando usar

- Antes de marcar fix ou feature como concluído.
- Ao implementar handler gRPC, service, validação, entity/transação ou correção de bug.
- Quando o usuário pedir testes, cobertura ou validação de que o teste não "mente".
- Junto com [`review`](../review/SKILL.md) no pré-merge (testes verdes no escopo).

## Roteador de camadas

```
Pedido de teste
    ├─ fix ou feature (OBRIGATÓRIO) → scenarios.md
    ├─ feature / bug / refactor de comportamento → tdd.md
    ├─ mock, assert, falso positivo → good-tests.md
    ├─ cobertura, linhas sem teste → coverage.md
    ├─ service, provider, TestingModule, Repository/DataSource, disco → nest-unit.md
    └─ handler gRPC, stream, status code, e2e (gRPC ou HTTP) → grpc.md
```

| Camada | Sinais | Arquivo |
|--------|--------|---------|
| Matriz de cenários | qualquer fix/feature | [scenarios.md](scenarios.md) |
| TDD | RED-GREEN-REFACTOR, bug novo | [tdd.md](tdd.md) |
| Testes honestos | espelho, assert em mock, mutação | [good-tests.md](good-tests.md) |
| Cobertura | `test:cov`, linhas faltando | [coverage.md](coverage.md) |
| Unit NestJS | `Test.createTestingModule`, `getRepositoryToken`, `DataSource`, tmp dir | [nest-unit.md](nest-unit.md) |
| gRPC e e2e | `ServerReadableStream` falso, `RpcException`, cliente `@grpc/grpc-js`, `supertest` | [grpc.md](grpc.md) |

Exemplos do domínio: [examples.md](examples.md).

## Regressão obrigatória

- **Não concluir** fix/feature sem teste automatizado que falharia antes da mudança e passa depois (quando reprodutível).
- Incluir no PR/resumo: arquivos de teste, matriz ramo → teste, comando, resultado.
- Checklist:
  - [ ] Comportamento que quebrava ou contrato novo identificado
  - [ ] [scenarios.md](scenarios.md) aplicada (feliz + erros aplicáveis)
  - [ ] RED observado quando o bug é reprodutível (ver [tdd.md](tdd.md))
  - [ ] `npm test -- <path>` verde; suíte relevante sem falhas omitidas

## Workflow

1. **Contrato** — mensagem de resposta, status gRPC (`code`), efeito no banco, efeito em disco.
2. **Matriz** — listar ramos; preencher [scenarios.md](scenarios.md).
3. **Nível** — unit (service com dependências mockadas na fronteira) e/ou e2e (cliente gRPC real contra o app).
4. **Escrever** — TDD quando couber; expected literal ([good-tests.md](good-tests.md)).
5. **Executar** — comandos abaixo; reportar comando e escopo.
6. **Não concluir** com só teste manual (grpcurl/Postman) ou happy path único sem os erros declarados.

## O que o teste tem de pegar

Além do caminho feliz ([scenarios.md](scenarios.md)):

- **Falso positivo:** expected calculado pelo código sob teste; assert só em mock (`toHaveBeenCalled`); `resolves.toBeDefined()` sem checar conteúdo, banco ou disco.
- **Teste para passar:** assert afrouxado, `it.skip`, mock no método que contém o bug, `jest.setTimeout` alto escondendo stream travado.
- **Ordem frágil:** autorização depois do write; arquivo aberto antes de validar o frame de metadata; banco gravado antes de checar o limite de tamanho; arquivo movido antes do commit.
- **Mutação:** limite de bytes errado, branch trocado, retorno vazio, frame fora de ordem aceito, caller sem permissão aceito — algum teste deve falhar.

## Comandos (Plexus)

| Escopo | Comando |
|--------|---------|
| Unit — um arquivo | `npm test -- src/modules/clinical/clinical.service.spec.ts` |
| Unit — por nome | `npm test -- -t "rejects chunk before metadata"` |
| Unit — tudo | `npm test` |
| E2E | `npm run test:e2e` (ou `npm run test:e2e -- test/clinical.e2e-spec.ts`) |
| Cobertura | `npm run test:cov -- --collectCoverageFrom="src/modules/clinical/**/*.ts"` |
| Antes de concluir | `npm run lint` e `npx tsc --noEmit -p tsconfig.json` |

Os scripts já rodam o Jest com `node --experimental-vm-modules`; não chame `npx jest` direto, senão o modo de execução muda.

## O que incluir

- **Bug:** reproduz a falha original (ex.: chunk antes de metadata → antes estourava `TypeError`, agora `INVALID_ARGUMENT`).
- **Feature:** feliz com resposta + banco + disco, e os erros da matriz (validação, auth, escopo, tamanho, falha de banco, cancelamento).
- **Mock:** fronteira (Repository/`DataSource`, cliente gRPC externo, relógio). Disco: diretório temporário real, não `fs` mockado.

## Exceções

Só sem teste automatizado se o usuário recusar ou a reprodução for impossível no CI. Documente no PR e sugira verificação manual (grpcurl/cliente) com os passos.

## Checklist de conclusão

- [ ] Caminho feliz: resposta (campos derivados à mão), efeito no banco e no disco
- [ ] Ao menos um teste por caminho de erro declarado (validação, `UNAUTHENTICATED`/`PERMISSION_DENIED`, `NOT_FOUND` fora do escopo, tamanho, falha externa)
- [ ] Tabela ramo → teste no resumo (ou omissões justificadas)
- [ ] Sem falso positivo óbvio ([good-tests.md](good-tests.md))
- [ ] Nenhum arquivo temporário ou registro sobrando após os testes
- [ ] `npm test` (e `test:e2e` quando aplicável) com exit 0 no escopo alterado

## Quando chamar outra skill

| Situação | Carregar |
|----------|----------|
| Contrato proto, DI, entity, transação, erro gRPC esperado | [`nestjs-grpc`](../nestjs-grpc/SKILL.md) — não duplicar regras de implementação aqui |
| Pré-merge ou checklist Done | [`review`](../review/SKILL.md) — [quality-gate.md](../review/quality-gate.md) |
| Cenário de corrida (CPF duplicado, lock) | [review/concurrency-review.md](../review/concurrency-review.md) |
| Dados de teste com CPF/nome | [review/lgpd.md](../review/lgpd.md) — só dados fictícios |
| Commitar após verde | comando `/commit` |

## Referências cruzadas

- [`nestjs-grpc`](../nestjs-grpc/SKILL.md) — implementação.
- [`review`](../review/SKILL.md) — quality gate e revisão pré-merge.
- Spec do produto: [docs/CONTEXT.md](../../../docs/CONTEXT.md).
- Índice: [../README.md](../README.md).

## Fontes

- `test` — skills v11 (Celer), adaptada de pytest/DRF para Jest/NestJS/gRPC.
- TDD e testes honestos: [obra/superpowers](https://github.com/obra/superpowers) (via skills v11).
- Unit/e2e NestJS: `test-*` de [kadajett/agent-nestjs-skills](https://github.com/kadajett/agent-nestjs-skills) e `testing-patterns` de [jeffallan/claude-skills](https://github.com/jeffallan/claude-skills).
