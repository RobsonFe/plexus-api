# Quality Gate (Plexus)

Portão único pré-merge: **review de engenharia** + **lint/typecheck/testes no escopo** + **LGPD** quando houver dado de paciente.

## Camadas e skills relacionadas

| Recurso | Quando | Arquivo |
|---------|--------|---------|
| [SKILL.md](SKILL.md) | Núcleo + roteador | `review` |
| [llm-smells.md](llm-smells.md) + [nestjs-pass.md](nestjs-pass.md) | Todo PR / diff pós-LLM | camadas |
| [grpc-review.md](grpc-review.md) | `.proto`, handler gRPC, bootstrap | camada |
| [lgpd.md](lgpd.md) | paciente, CPF, notas, arquivo, logs | camada |
| [nestjs-grpc](../nestjs-grpc/SKILL.md) | correção de achados | skill de implementação |
| [test](../test/SKILL.md) | teste de regressão (obrigatório) | `test` — [scenarios.md](../test/scenarios.md) |

## Workflow PR

```
1. Entender a mudança e o requisito (docs/CONTEXT.md)
2. review — núcleo + llm-smells.md + nestjs-pass.md
3. .proto / @Grpc* → grpc-review.md
4. Dados de paciente → lgpd.md
5. Queries/transações → typeorm-perf.md / concurrency-review.md
6. Corrigir Crítico / Obrigatório (nestjs-grpc)
7. Teste de regressão RED → GREEN
8. Rodar comandos abaixo e reportar: arquivo de teste + comando + resultado
```

## Comandos

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run test:e2e
npm run build
npx prettier --check "src/**/*.ts" "test/**/*.ts"
```

O projeto tem `package-lock.json` e `pnpm-lock.yaml`. Use o gerenciador que o time adotar e não atualize os dois lockfiles de forma divergente (sinalizar se o diff mexe em só um).

## Done

- [ ] Sem Crítico aberto na review.
- [ ] Teste de regressão que falharia antes da mudança.
- [ ] `lint`, `tsc --noEmit` e `test` com exit 0 no escopo alterado.
- [ ] `test:e2e` verde quando o diff toca controller, bootstrap ou `.proto`.
- [ ] `build` verde e `.proto` presente no `dist` quando o diff toca proto/nest-cli.
- [ ] LGPD: nenhum dado de paciente em log/erro/resposta desnecessária.
- [ ] `.proto` compatível (ou versão nova) e interface TS alinhada.
- [ ] Claims do PR (lint local, "sem breaking change", checklist marcado) reproduzidas localmente, não assumidas.
- [ ] Falhas de teste fora do escopo comparadas contra o merge-base antes de serem descartadas como pré-existentes.
- [ ] Helpers/mocks de teste novos não mascaram o caminho real validado.
