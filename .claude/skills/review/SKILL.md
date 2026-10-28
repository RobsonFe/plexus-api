---
name: review
description: Revisão técnica unificada do Plexus (NestJS + gRPC + TypeORM). Orquestra camadas de quality gate pré-merge, smells de código gerado por LLM, pass NestJS, contrato e streaming gRPC, segurança, LGPD (dados de saúde/CPF), performance TypeORM, concorrência/transações, review em dois eixos (Padrões/Spec) e TypeScript. Use para revisar PRs, diffs, mudanças staged, código pós-agente, "revisar desde X" ou deixar lint/testes verdes antes do merge.
---

# Review

Skill única de revisão técnica do `plexus-api`. O núcleo abaixo fica **sempre ativo**; camadas especializadas em arquivos irmãos são carregadas pelo roteador.

Consolida: `review` (skills v11, adaptada de Django para NestJS), `code-review` (Matt Pocock, dois eixos) e `nestjs-code-review` (giuseppe-trisciuoglio).

Implementação e correções seguem [`nestjs-grpc`](../nestjs-grpc/SKILL.md). Spec do produto: [docs/CONTEXT.md](../../../docs/CONTEXT.md).

## Quando usar

- Revisar PR, branch, diff, alterações staged ou código gerado por agente antes do merge.
- Qualquer mudança que receba input externo (metadata/chunks gRPC, DTO HTTP), auth, upload ou integração.
- Qualquer mudança que toque dados de paciente, notas clínicas ou arquivos médicos.
- Fechar fix/feature (teste de regressão obrigatório).

## Definir o escopo do diff

| Pedido | Comando |
|--------|---------|
| "revisa o que está staged" | `git diff --staged` |
| "revisa minhas mudanças" | `git diff HEAD` (+ arquivos untracked relevantes) |
| "revisa a branch" / "desde X" | `git diff <X>...HEAD` + `git log <X>..HEAD --oneline` → camada [two-axis-review.md](two-axis-review.md) |
| PR do GitHub | `gh pr diff <n>` |

Confirme que o diff não está vazio antes de seguir.

## Roteador de camadas

Classifique o diff e carregue **apenas** as camadas que se aplicam. O núcleo deste arquivo continua ativo.

```
Diff / pedido de review
        │
        ├─ PR completo / pré-merge / "deixar verde"
        │     → QUALITY_GATE → quality-gate.md
        │
        ├─ Código pós-LLM, helper duplicado, try/catch amplo, abstração especulativa
        │     → LLM_SMELLS → llm-smells.md + nestjs-pass.md
        │
        ├─ *.module.ts, controller, service, provider, guard, pipe, filter, interceptor
        │     → NESTJS → nestjs-pass.md
        │
        ├─ *.proto, @Grpc*, streaming, RpcException, main.ts (microservice)
        │     → GRPC → grpc-review.md
        │
        ├─ Auth, upload, path em disco, CORS, segredo, input externo, dependência nova
        │     → SECURITY → security-hardening.md
        │
        ├─ CPF, paciente, notas clínicas, arquivo médico, logs, respostas
        │     → LGPD → lgpd.md (+ lgpd-reference.md para artigos)
        │
        ├─ Entity, find/QueryBuilder, relations, listagem, índice, save em loop
        │     → TYPEORM_PERF → typeorm-perf.md
        │
        ├─ Transação, lock, unique race, side effect (disco/evento) vs commit
        │     → CONCURRENCY → concurrency-review.md
        │
        ├─ "Revisar desde X", branch vs issue/spec
        │     → TWO_AXIS → two-axis-review.md
        │
        └─ *.ts genérico: tipos, any, async/await, erros
              → TYPESCRIPT → typescript-review.md
```

| Camada | Sinais | Arquivo |
|--------|--------|---------|
| Quality gate | merge, PR completo, checklist Done | [quality-gate.md](quality-gate.md) |
| Smells LLM | código de agente, abstração especulativa, comentário óbvio | [llm-smells.md](llm-smells.md) |
| Pass NestJS | módulos, DI, controllers finos, guards/pipes/filters | [nestjs-pass.md](nestjs-pass.md) |
| gRPC | compatibilidade de proto, status codes, streaming, reflection | [grpc-review.md](grpc-review.md) |
| Segurança | injection, IDOR, path traversal, segredos, rate limit | [security-hardening.md](security-hardening.md) |
| LGPD | dados de saúde, CPF, logs, mascaramento | [lgpd.md](lgpd.md), [lgpd-reference.md](lgpd-reference.md) |
| Performance TypeORM | N+1, find sem limite, índices, writes em loop | [typeorm-perf.md](typeorm-perf.md) |
| Concorrência | transação, lock, side effect pós-commit, invariante em todos os entry points | [concurrency-review.md](concurrency-review.md) |
| Dois eixos | Padrões vs Spec, ponto fixo git, sub-agentes | [two-axis-review.md](two-axis-review.md) |
| TypeScript | `strict`, `any`, promises soltas, erros | [typescript-review.md](typescript-review.md) |

## Workflow de review completo

Ordem para PR ou diff substancial (detalhes em [quality-gate.md](quality-gate.md)):

1. Entender a mudança e o requisito (RF/RNF em [docs/CONTEXT.md](../../../docs/CONTEXT.md)).
2. Revisar testes primeiro — teste ausente sinaliza caminho não coberto.
3. Aplicar o núcleo deste arquivo (arquitetura, segurança resumida, dados sensíveis).
4. **Segurança antes de estilo:** [llm-smells.md](llm-smells.md) + [nestjs-pass.md](nestjs-pass.md).
5. Tocou `.proto` ou handler gRPC → [grpc-review.md](grpc-review.md).
6. Tocou dados de paciente/arquivo → [lgpd.md](lgpd.md).
7. Tocou queries/entities → [typeorm-perf.md](typeorm-perf.md). Transação/lock/efeito fora do banco → [concurrency-review.md](concurrency-review.md).
8. Pedido "desde commit/branch" → [two-axis-review.md](two-axis-review.md).
9. Traçar autenticação e autorização da metadata gRPC até a query.
10. Edge cases: stream vazio, ordem de frames, limite de tamanho, cancelamento, CPF duplicado, `bigint`.
11. Corrigir achados **Crítico**/**Obrigatório** (via [`nestjs-grpc`](../nestjs-grpc/SKILL.md)).
12. Rodar o protocolo de verificação (abaixo) e reportar com o template.

## Template de output

```markdown
## Achados
- Crítico: [arquivo:linha / símbolo] [problema]. Por que falha, impacto e correção obrigatória.
- Obrigatório: [arquivo:linha / símbolo] [problema]. Caminho ausente ou risco.
- Sugestão: [arquivo:linha / símbolo] [melhoria].
- Detalhe: [arquivo:linha / símbolo] [nota menor].

## Pontos positivos
- [O que está bem feito e deve ser mantido — curto.]

## Perguntas em aberto
- [Apenas o que afeta correção ou risco.]

## Gaps de verificação
- [Testes/checks não executados ou fora de escopo.]
```

Regras de reporte:

- Todo Crítico/Obrigatório tem evidência (`arquivo:linha` + trecho) e correção concreta. Sem evidência → rebaixar ou remover.
- Preferência de estilo que o Prettier/oxlint já cobre **não** é achado.
- Respeitar convenções do projeto mesmo quando diferem do default NestJS.
- Não sugerir reescrita arquitetural salvo achado crítico que a exija.
- Sem achados → declarar explicitamente e listar riscos residuais/áreas não verificadas.

## Revisão de arquitetura (núcleo)

Regras de referência: [plexus-rules.md](../../rules/plexus-rules.md) §§1, 3–7.

- **Código enxuto (KISS) — achado Obrigatório, não Sugestão:**
  - helper, função auxiliar, `utils.ts`, wrapper ou constante de **uso único** → pedir inline;
  - método que só repassa para outra camada sem agregar nada → remover;
  - abstração especulativa (token/interface/factory com uma implementação, parâmetro que ninguém usa, pasta vazia "para padronizar") → remover.
  Confirme o uso único com Grep antes de reportar.
- **Camadas (Controller → Service → Repository, + Mapper) — violação é Obrigatório:**
  - Service importando `typeorm`, `Repository<T>`, `DataSource` ou `@InjectRepository`;
  - Controller acessando repository/banco ou com regra de negócio;
  - Repository com regra de negócio;
  - entity TypeORM devolvida ao cliente sem Mapper.
- Módulo por feature, pastas por camada; `AppModule` só compõe. Sem ciclo entre módulos; `forwardRef` justificado.
- DI por construtor; nada de `new` em `@Injectable`; singleton sem estado de requisição.
- Proto é o contrato: interface TS espelha o `.proto` no mesmo diff; Get → `result`, List → `results` + `meta`.

## Revisão de banco (núcleo)

- Queries e transações só no repository; o service pede um método atômico (`saveRecordWithFile`).
- Escrita multi-tabela atômica em `DataSource.transaction` usando o `manager`.
- Sem I/O lento (stream do arquivo) dentro da transação.
- Sem N+1; listagens com limite; queries parametrizadas.
- `synchronize: true` fora de dev é **Crítico**; mudança de schema exige migration.
- `bigint` tipado coerentemente (`string` ou transformer).

## Revisão de segurança (núcleo)

Trate todo input externo como hostil, todo segredo como sagrado e toda autorização como obrigatória.

### Sempre

- Validar input na fronteira: DTO + `ValidationPipe` (com `RpcException`) e validação manual do frame de metadata em streams.
- Queries parametrizadas (QueryBuilder `:param`, `query($1)`), nunca interpolação.
- Limites: tamanho por mensagem e total por arquivo; `MaxLength` em strings.
- Path de arquivo gerado pelo servidor; MIME por allowlist.
- Erros ao cliente sem stack, SQL ou path interno.

### Perguntar antes (aprovação humana)

- Novo fluxo de autenticação ou mudança de auth.
- Nova categoria de dado sensível (diagnóstico, CID, nascimento...).
- Mudança de CORS, limites de upload, rate limit, reflection em produção.
- Exclusão física de prontuário/arquivo médico (retenção legal).

### Nunca

- Commitar segredo (inclui placeholders que viram valor real, como `appKey`/`appSecret`).
- Logar CPF, nome, telefone, notas clínicas, conteúdo de arquivo ou token.
- Usar `fileName` do cliente no path em disco.
- `eval`, `new Function`, `child_process` com input externo.

### Autorização

- Toda chamada gRPC/HTTP protegida verifica autenticação **e** autorização por recurso (paciente/prontuário).
- IDOR: buscar por `id` sem checar vínculo do caller → **Crítico**. Fora do escopo → `NOT_FOUND`.

## Revisão de qualidade (núcleo)

- TypeScript `strict` respeitado: sem `any` novo, sem `as` para calar erro real, sem `!` desnecessário.
- Código, nomes e testes em inglês (RNF04); mensagens ao cliente (`RpcException`, validação) e comentários em **PT-BR**.
- **JSDoc** obrigatório em método público de service, repository, mapper e função exportada (`@param`, `@returns`, `@throws`) — ausência é Obrigatório.
- Métodos < 30 linhas (ideal), **> 50 linhas é Obrigatório**; aninhamento profundo → guard clauses.
- Comentário inline só para decisão não óbvia, workaround ou limitação externa; comentário narrando código é achado.
- Sem `console.log` (usar `Logger` com contexto).
- `try/catch` só com tradução/recuperação real; erros não engolidos.

## Testes de regressão (obrigatório)

Não marque fix ou feature como concluído sem pelo menos um teste que falharia antes da mudança e passa depois.

- Fix: reproduz o caminho de falha original.
- Feature: caminho feliz + erro relevante (ver matriz em [test/scenarios.md](../test/scenarios.md)).
- Mock na fronteira (repositório, disco, cliente externo), não dentro do código sob teste.
- Só pular quando o usuário declinar explicitamente; documentar por quê.

## Protocolo de verificação

```powershell
npm run lint                     # oxlint --type-aware
npx tsc --noEmit -p tsconfig.json
npm test
npm run test:e2e                 # se tocou controller, bootstrap ou proto
npm run build                    # se tocou nest-cli/proto/assets
npm audit --omit=dev             # se adicionou/atualizou dependência
```

Nunca concluir a review com lint, typecheck ou testes falhando no escopo alterado. Se uma falha parece pré-existente, compare com o merge-base antes de descartá-la.

## Checklist de verificação

- [ ] Nenhum achado de segurança crítico aberto (injection, IDOR, path traversal, vazamento, segredo).
- [ ] Autenticação e autorização por recurso em todo handler alterado.
- [ ] Nenhum dado de paciente em log, erro ou resposta desnecessária.
- [ ] `.proto` compatível com clientes existentes (ou versão nova); interface TS alinhada.
- [ ] Streaming: primeiro frame validado, limite total, cleanup em erro/cancelamento, sem buffer do arquivo inteiro.
- [ ] Transações corretas; efeitos fora do banco após commit; sem N+1.
- [ ] Código enxuto: nenhum helper/wrapper de uso único nem abstração especulativa.
- [ ] Camadas respeitadas (Service sem TypeORM; Mapper na saída); JSDoc nos métodos públicos.
- [ ] Teste de regressão presente e executado; lint e typecheck verdes.

## Quando chamar outra skill

| Situação | Carregar |
|----------|----------|
| Corrigir achado (módulo, DI, proto, entity, DTO) | [`nestjs-grpc`](../nestjs-grpc/SKILL.md) + camada correspondente |
| Escrever/ajustar teste de regressão | [`test`](../test/SKILL.md) — [scenarios.md](../test/scenarios.md) |
| Commitar após review verde | comando `/commit` |

## Referências cruzadas

**Camadas `review`:** [quality-gate.md](quality-gate.md) · [llm-smells.md](llm-smells.md) · [nestjs-pass.md](nestjs-pass.md) · [grpc-review.md](grpc-review.md) · [security-hardening.md](security-hardening.md) · [lgpd.md](lgpd.md) · [typeorm-perf.md](typeorm-perf.md) · [concurrency-review.md](concurrency-review.md) · [two-axis-review.md](two-axis-review.md) · [typescript-review.md](typescript-review.md)

**Outras skills:** [`nestjs-grpc`](../nestjs-grpc/SKILL.md) · [`test`](../test/SKILL.md) · índice em [../README.md](../README.md)

## Fontes

- `review` — skills v11 (Celer), estrutura e camadas adaptadas para NestJS/gRPC.
- `code-review` — Matt Pocock, [github.com/mattpocock/skills](https://github.com/mattpocock/skills) (dois eixos, baseline de smells Fowler).
- `nestjs-code-review` — giuseppe-trisciuoglio, [github.com/giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) (checklist, patterns, anti-patterns).
