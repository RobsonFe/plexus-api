# Backend Quality Gate

Skills em `.claude/skills/` deste repositório (ver [AGENTS.md](../AGENTS.md) e [skills/README.md](../skills/README.md)):

| Situação | Skill / camada |
|----------|----------------|
| Implementação NestJS / gRPC / proto / TypeORM / DTO | `nestjs-grpc` → [SKILL.md](../skills/nestjs-grpc/SKILL.md) |
| Revisão técnica, segurança, LGPD, gRPC, perf, TypeScript, pré-merge | `review` → [SKILL.md](../skills/review/SKILL.md) |
| Pré-merge (workflow + Done) | `review` → [quality-gate.md](../skills/review/quality-gate.md) |
| Smells LLM / checklist NestJS | `review` → [llm-smells.md](../skills/review/llm-smells.md) + [nestjs-pass.md](../skills/review/nestjs-pass.md) |
| Contrato `.proto` / streaming | `review` → [grpc-review.md](../skills/review/grpc-review.md) |
| LGPD / dados de paciente | `review` → [lgpd.md](../skills/review/lgpd.md) |
| Fix ou feature nova (testes) | `test` → [SKILL.md](../skills/test/SKILL.md) |
| Mensagem de commit | `/commit` → [commit.md](../commands/commit.md) |

**Cadeia pré-merge:** `review` [quality-gate.md](../skills/review/quality-gate.md) → achados corrigidos com `nestjs-grpc` → `test` ([scenarios.md](../skills/test/scenarios.md) em fix/feature) → `/commit`.

**Comandos (raiz do repositório):**

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run test:e2e   # quando tocar controller, bootstrap ou .proto
npm run build      # quando tocar .proto ou nest-cli.json
```

**Regras sempre ativas:** [plexus-rules.md](./plexus-rules.md)

**Handoff:** [skills/README.md](../skills/README.md#handoff-entre-skills) · seção *Quando chamar outra skill* em cada orquestrador em `skills/*/SKILL.md`
