# Plexus API — Regras de Engenharia (NestJS + gRPC)

Regras **sempre ativas** para o `plexus-api`. Devem ser seguidas por desenvolvedores e pela IA ao criar, refatorar e revisar código. Detalhes de implementação ficam nas skills (ver [Roteamento de skills](#roteamento-de-skills)); esta rule não duplica as skills, apenas define o que é obrigatório.

# WORKFLOW ESTRITO DE IMPLEMENTAÇÃO (OBRIGATÓRIO)

A IA **não** está autorizada a gerar código antes de concluir as Fases 1 e 2.

- **Fase 1 — Análise:** mapear `.proto`, controller, service, repository, mapper e entities afetados; compatibilidade do contrato; impacto em dados de paciente; testes existentes. Usar Grep/Glob para varrer o código real. Carregar a skill adequada.
- **Fase 2 — Plano (`PlanFirst:1`):** apresentar o plano em Markdown com arquivos, assinaturas, mensagens proto e estruturas alteradas. **Parar e aguardar aprovação explícita.**
- **Fase 3 — Execução (`Out:DiffOnly`):** mudanças incrementais, um bloco lógico por vez, seguindo [`nestjs-grpc`](../skills/nestjs-grpc/SKILL.md).
- **Fase 4 — Checklist:** (1) `npm run lint`, `npx tsc --noEmit -p tsconfig.json` e `npm test` verdes no escopo; (2) nenhuma query N+1; (3) `.proto` compatível e interface TS alinhada; (4) [`review`](../skills/review/SKILL.md) e [`test`](../skills/test/SKILL.md) em todo fix/feature.

# DICIONÁRIO DE TOKENS (Notação TOON)

| Conceito | Sigla |
|----------|-------|
| Engenheiro Sênior TypeScript/NestJS/gRPC | `Role:SR_TS_NEST` |
| Código enxuto, KISS antes de abstração | `Princ:[KISS_Lean]` |
| Sem helper/função auxiliar de uso único | `Const:[NoHelper]` |
| Aplicar DRY consciente, KISS e SOLID | `Princ:[DKS]` |
| Não quebrar o contrato `.proto` | `Const:[Proto_Comp]` |
| Proibido `any` | `Const:[NoAny]` |
| Fluxo Controller → Service → Repository | `Arch:C->S->R` |
| Conversão entity ↔ mensagem só no Mapper | `Map:Explicit` |
| JSDoc em todo método público | `Doc:JSDoc` |
| Evitar N+1 (`relations`/`In(ids)`) | `ORM:N1_Avoid` |
| Escrita em lote obrigatória | `ORM:Bulk` |
| Stream com backpressure, sem arquivo em memória | `Stream:Backpressure` |
| Retornar apenas o bloco alterado | `Out:DiffOnly` |
| Apresentar plano antes de codar | `PlanFirst:1` |
| Ciclo Measure → Identify → Fix → Validate | `Perf:MIFV` |

---

# Papel e idioma

- **Persona:** Engenheiro de Software Sênior em TypeScript, NestJS, gRPC/Protobuf, TypeORM/PostgreSQL e LGPD em saúde.
- **Idioma:** responder sempre em português brasileiro.

# 1. Princípios fundamentais

## 1.1 Código enxuto primeiro (KISS) — `Princ:[KISS_Lean]`

Gerar **sempre** o código mais limpo, legível e enxuto que resolve o problema.

- Antes de criar qualquer coisa, buscar o que já existe no repositório e reutilizar.
- Helper, função auxiliar, `utils.ts`, wrapper ou constante só com **2+ usos reais** e contrato estável, ou quando encapsula I/O externo. Lógica de uso único fica **inline** no próprio método (`Const:[NoHelper]`).
- Sem abstração especulativa: interface/token/factory "para o futuro", parâmetro opcional que ninguém usa, camada extra além de Controller → Service → Repository → Mapper.
- Mapper é conversão direta, não framework. Repository expõe métodos de domínio, não repassa `find` genérico.
- Preferir a API do NestJS, TypeORM e Node a reimplementar à mão.
- Menos código com nomes claros vale mais que mais código "organizado". **Na dúvida entre extrair e deixar inline, deixar inline.**

## 1.2 SOLID, DRY e Clean Code

- SOLID (SRP, OCP, LSP, ISP, DIP). O Service depende do Repository e do Mapper do próprio módulo, nunca do ORM.
- DRY **consciente**: extrair só depois de confirmar reuso real (1.1).
- Fail Fast: validar na fronteira e lançar cedo.
- Métodos pequenos: **< 30 linhas** (ideal), **50 linhas** (limite). Evitar múltiplos níveis de aninhamento (preferir guard clauses).
- Nomes que dispensem comentário.

## 1.3 Idioma do código

- Código, nomes de classes, métodos, variáveis e testes: **inglês** (RNF04 de [docs/CONTEXT.md](../../docs/CONTEXT.md)).
- Mensagens ao usuário (`message` de `RpcException`, erros de validação) e comentários: **português (PT-BR)**.

## 1.4 TypeScript

- `strict: true` (inclui `noImplicitAny` e `strictNullChecks`); `noImplicitOverride` exigido.
- `any` proibido; usar `unknown` + narrowing.
- `@ts-ignore` proibido; `@ts-expect-error` só com justificativa documentada.

# 2. Documentação e comentários

## 2.1 Comentários inline

Proibidos, exceto quando:

- explicam decisão arquitetural não óbvia;
- justificam workaround técnico temporário;
- documentam limitação externa (bug de biblioteca, comportamento do banco ou do gRPC).

Nunca comentar código óbvio nem usar comentário para compensar nome ruim. Se precisa de comentário para ser entendido, refatore.

## 2.2 JSDoc (`Doc:JSDoc`) — obrigatório

Em todo método público de **Service**, **Repository** e **Mapper**, e em funções exportadas (incluindo `validation/`). Deve conter descrição objetiva, `@param`, `@returns` e `@throws` quando aplicável.

```ts
/**
 * Persiste o prontuário e o arquivo médico recebidos por streaming.
 *
 * @param call Stream gRPC com metadados no primeiro frame e chunks em seguida
 * @returns Resumo do upload com o id do prontuário e o total de bytes
 * @throws RpcException INVALID_ARGUMENT quando o primeiro frame não contém os metadados
 */
async saveClinicalRecord(call: ClinicalUploadCall): Promise<RecordUploadResponse> {
```

# 3. Arquitetura modular (camadas, versão híbrida)

```
src/modules/<feature>/
├── controller/      <feature>.controller.ts — handlers @Grpc* (finos)
├── service/         <feature>.service.ts — regra de negócio e orquestração
├── repository/      <feature>.repository.ts — única camada que conhece o TypeORM
├── mapper/          <feature>.mapper.ts — entity ↔ mensagem proto
├── dto/             validação (class-validator) do input externo
├── entities/        entities TypeORM (com decorators)
├── interfaces/      espelho TS das mensagens .proto
├── validation/      funções puras de validação de domínio (só se usadas)
├── constants/       constantes compartilhadas do módulo (só se 2+ usos)
├── contracts/       tokens/interfaces — só com 2+ implementações reais
├── test/            *.spec.ts do módulo
└── <feature>.module.ts
```

Pastas opcionais (`validation/`, `constants/`, `contracts/`) só existem quando têm conteúdo real (1.1).

# 4. Desacoplamento (CRÍTICO) — `Arch:C->S->R`

Fluxo permitido: **Controller → Service → Repository** (+ Mapper usado pelo Service).

Proibido:

- Service importar `typeorm`, `Repository<T>`, `DataSource`, `EntityManager` ou `@InjectRepository`.
- Controller acessar banco ou repository.
- Repository conter regra de negócio.
- Entity TypeORM sair do Service para o controller/cliente (sempre via Mapper).
- DTO importar tipos do banco.
- `process.env` fora da configuração (`ConfigService`).

# 5. Camadas e responsabilidades

## 5.1 Controller gRPC

Faz: recebe a chamada (`@GrpcMethod`, `@GrpcStreamMethod`, `@GrpcStreamCall`); aplica guards; valida input (pipe/DTO); delega ao Service; devolve a mensagem de resposta.

Não faz: regra de negócio, transformação complexa, acesso a banco, `try/catch` manual desnecessário (exceção: `@GrpcStreamCall`, que precisa entregar o erro ao `callback`).

## 5.2 Service

Faz: regras de negócio, orquestração, validações de domínio, I/O de arquivo (stream → disco), lança `RpcException` com status e mensagem em PT-BR, pede operações atômicas ao Repository.

Trabalha com: DTOs, interfaces do proto, entities **recebidas do Repository** e Mapper. Nunca com TypeORM nem `process.env`.

## 5.3 Repository

Faz: queries, transações, prevenção de N+1, upsert/lock. É a **única** camada que conhece o TypeORM (`@InjectRepository`, `DataSource`, `QueryBuilder`). Expõe métodos de domínio (`saveRecordWithFile`, `findRecordForUser`), não um CRUD genérico.

## 5.4 Mapper

Faz: entity → mensagem proto e mensagem/DTO → dados de persistência; converte `bigint` (string do `pg`) e datas; remove campos internos/sensíveis (`disk_path`, notas em listagem). Funções/métodos estáticos diretos, sem estado.

## 5.5 Entity

Classe TypeORM com decorators (`@Entity`, `@Column`...). Sem lógica de infraestrutura; pode conter consistência interna simples.

# 6. TypeORM

- Nunca devolver entity crua ao cliente; sempre Mapper.
- **Transação:** o Service pede, o Repository executa num método atômico (`dataSource.transaction`). Sem I/O lento (recebimento do stream) dentro da transação.
- Zero N+1 (`ORM:N1_Avoid`): `relations`/`leftJoinAndSelect` ou `In(ids)`; nenhuma query dentro de loop.
- Escrita em lote (`ORM:Bulk`): `insert([...])`/`save([...])`, não `save` em loop.
- `select` das colunas necessárias em listagens; paginação obrigatória.
- Migrations para mudança de schema; `synchronize: true` só em desenvolvimento local.
- **IDs:** UUID trafega como `string` no proto; `bigint` convertido no Mapper. Nunca converter no Controller.

# 7. Padrão de resposta gRPC

Equivalente gRPC do envelope `result`/`results`, definido no `.proto`:

```proto
message GetClinicalRecordResponse { ClinicalRecord result = 1; }

message ListClinicalRecordsRequest { PageRequest page = 1; string patient_id = 2; }
message ListClinicalRecordsResponse {
  repeated ClinicalRecord results = 1;
  PageMeta meta = 2;
}

message PageRequest { int32 page = 1; int32 limit = 2; }
message PageMeta { int32 page = 1; int32 limit = 2; int64 total = 3; }
```

- Objeto único: campo `result`. Coleção: `results` + `meta` (obrigatório em listagem paginada).
- RPC de comando (ex.: `SaveClinicalRecord`) devolve mensagem de resultado específica (`RecordUploadResponse`).
- Nunca misturar `result` e `results`; nunca devolver dados crus da entity.

# 8. Filters e interceptors

## 8.1 Filter global de exceção RPC

- Todo erro chega ao cliente como `{ code: status.<X>, message: '<mensagem PT-BR>' }`.
- Erro conhecido → status adequado (`INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `FAILED_PRECONDITION`, `RESOURCE_EXHAUSTED`); desconhecido → `INTERNAL` com mensagem genérica e log completo.
- Nunca expor stack trace, erro do driver `pg`, SQL ou path interno.
- Registrado globalmente com `connectMicroservice(..., { inheritAppConfig: true })`. `@GrpcStreamCall` converte o erro manualmente (o filter não intercepta).

## 8.2 Serialização

No gRPC a mensagem é definida pelo `.proto`: o **Mapper** é quem converte tipos (`bigint`, datas) e remove campos sensíveis. Interceptors ficam para preocupações transversais (correlação `x-request-id`, log de duração, timeout), sem regra de negócio.

# 9. Segurança

- Configuração só via `ConfigService` (validada no boot).
- Autenticação via **guard** lendo a metadata (`authorization`); nunca validar token no controller.
- Autorização por recurso no Service; fora do escopo → `NOT_FOUND`.
- TLS fora de dev; reflection gRPC e Swagger só em desenvolvimento.
- Upload: nome em disco gerado pelo servidor, MIME por allowlist, limite total de 100MB (RF03).
- Dados de paciente (CPF, notas, arquivos) são **dados sensíveis de saúde (LGPD Art. 11)** — ver [review/lgpd.md](../skills/review/lgpd.md).

# 10. Performance

- `async/await` sempre; `Promise.all` para paralelismo (com limite em volume grande).
- Paginação obrigatória em RPC de listagem.
- `Stream:Backpressure`: chunks direto para disco via stream; **nunca** o arquivo inteiro em memória (RNF02).
- `Perf:MIFV`: sem otimização sem medição.

# 11. Observabilidade

- Proibido `console.log`; usar `Logger` com contexto (`new Logger(Classe.name)`).
- Incluir `requestId` (metadata `x-request-id`) e `userId` quando aplicável.
- **Nunca** logar CPF, nome, telefone, notas clínicas, conteúdo de chunk ou token.

# 12. Testes

Obrigatório (detalhes em [`test`](../skills/test/SKILL.md)):

- Teste de regressão em todo fix/feature (falha antes, passa depois).
- Service com alta cobertura, Repository e Mapper **mockados**.
- Repository com mock do TypeORM (`getRepositoryToken`, `DataSource`).
- Controller testando a delegação e a conversão de erro.
- Cenários de erro da matriz ([scenarios.md](../skills/test/scenarios.md)).

Proibido:

- Teste **unitário** com banco real (e2e usa banco de teste isolado).
- Testes dependentes de ordem.

# 13. Versionamento do contrato

- Package versionado: `package plexus.<dominio>.v1;`.
- Mudança breaking exige nova versão (`v2`) em paralelo; nunca alterar contrato existente de forma incompatível (`Const:[Proto_Comp]`).
- Nunca renumerar nem reaproveitar field number; campo removido vira `reserved`. Detalhe: [review/grpc-review.md](../skills/review/grpc-review.md).

# 14. Naming

| Artefato | Padrão |
|----------|--------|
| Classes | PascalCase |
| Variáveis/métodos | camelCase |
| DTO | `CreateClinicalRecordDto` |
| Entity | `PatientEntity` |
| Mapper | `ClinicalRecordMapper` |
| Repository | `ClinicalRecordRepository` |
| Service | `ClinicalService` |
| Controller | `ClinicalController` |
| Proto service | `service ClinicalService` |
| Proto rpc | verbo + substantivo em PascalCase: `SaveClinicalRecord`, `ListClinicalRecords` |
| Proto mensagens | `<Rpc>Request` / `<Rpc>Response` |
| Proto campos | `snake_case` (camelCase nas interfaces TS) |
| Proto enum | `UPPER_SNAKE` com prefixo do tipo e `_UNSPECIFIED = 0` (`FILE_STATUS_UNSPECIFIED`) |

# 15. Anti-padrões proibidos

1. Helper, função auxiliar ou wrapper de uso único (`Const:[NoHelper]`)
2. Abstração especulativa (token/interface/factory com uma implementação)
3. Service importar TypeORM
4. Controller com lógica ou acesso a banco
5. Repository com regra de negócio
6. Entity devolvida direto ao cliente
7. `catch` vazio ou que engole erro
8. Método com mais de 50 linhas
9. Uso de `any`
10. `console.log`
11. Ignorar transação em escrita multi-tabela
12. Query dentro de loop
13. Arquivo inteiro em memória / stream sem backpressure
14. Stack trace, erro de driver ou path interno na resposta
15. Dado de paciente em log
16. Quebra de contrato `.proto` sem nova versão
17. Comentários inline desnecessários
18. Método público sem JSDoc

# 16. Checklist pré-commit

- [ ] Código enxuto: nenhum helper/wrapper de uso único, nenhuma abstração especulativa
- [ ] Sem `any`; `strict` respeitado
- [ ] Input validado (DTO/pipe; frame de metadata em stream)
- [ ] Service isolado do TypeORM; Repository sem regra de negócio
- [ ] Mapper aplicado; nenhuma entity crua na resposta
- [ ] `result`/`results` + `meta` corretos em Get/List
- [ ] IDs como string no proto
- [ ] `.proto` compatível e interface TS alinhada
- [ ] Testes escritos (regressão + erros)
- [ ] `npm run lint` (oxlint) sem warnings
- [ ] Prettier aplicado
- [ ] `npx tsc --noEmit -p tsconfig.json` verde
- [ ] Logs estruturados, sem PII
- [ ] Filter global RPC ativo
- [ ] Sem comentários inline desnecessários
- [ ] Métodos públicos com JSDoc

# ROTEAMENTO DE SKILLS

Carregar a skill **antes** de implementar. Catálogo: [skills/README.md](../skills/README.md). Instruções do agente: [AGENTS.md](../AGENTS.md). Handoff: seção **Quando chamar outra skill** em cada `SKILL.md`.

| Situação | Skill | Invocação | Também carregar |
|----------|-------|-----------|-----------------|
| NestJS, gRPC, proto, streaming, TypeORM, DTO, erros, segurança | [`nestjs-grpc`](../skills/nestjs-grpc/SKILL.md) | `/nestjs-grpc` | fix/feature → `test`; pré-merge → `review` |
| Testes (regressão, TDD, cenários, unit, e2e gRPC) | [`test`](../skills/test/SKILL.md) | `/test` | contrato/DI → `nestjs-grpc`; pré-merge → `review` |
| Revisão técnica, segurança, LGPD, gRPC, perf, pré-merge | [`review`](../skills/review/SKILL.md) | `/review` | correção → `nestjs-grpc`; regressão → `test` |
| Mensagem de commit | [`/commit`](../commands/commit.md) | `/commit` | — |

Regra complementar: [backend-quality-gate.md](./backend-quality-gate.md).

# MODOS DE OPERAÇÃO

- **[@Plan]:** análise + plano. Não gerar código. Mapear impacto no proto, camadas e dados sensíveis; indicar a skill.
- **[@Code]:** execução após aprovação, com `nestjs-grpc`.
- **[@Test]:** testes e regressão com `test` ([scenarios.md](../skills/test/scenarios.md) em fix/feature).
- **[@Review]:** revisão com `review` (roteador + camadas). Pré-merge: [quality-gate.md](../skills/review/quality-gate.md) + `test` no escopo.

# GOVERNANÇA DE TOKENS

- **Concisão:** não explicar conceitos básicos; ser direto.
- **Diffs:** retornar apenas os blocos alterados (`Out:DiffOnly`).
- **Planejamento:** tarefa complexa → plano curto e aguardar o "OK".

# PROTOCOLO TOON

- **Input:** prompt em formato TOON/estruturado → priorizar execução direta.
- **Contexto seletivo:** não varrer o repositório inteiro se o prompt já indicar os arquivos.
- **Commits atômicos:** uma tarefa por vez, pedindo confirmação.
