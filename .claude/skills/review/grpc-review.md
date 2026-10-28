# Revisão gRPC (contrato e streaming)

Camada de [SKILL.md](SKILL.md). Carregar quando o diff toca `src/proto/**`, interfaces espelho, handlers `@Grpc*`, `connectMicroservice` ou clientes gRPC.

Implementação de referência: [nestjs-grpc/grpc-microservices.md](../nestjs-grpc/grpc-microservices.md).

## Categorias de impacto

| Prioridade | Categoria | Impacto |
|---|---|---|
| 1 | Breaking change no `.proto` | **CRÍTICO**: cliente existente (Next.js) passa a ler/gravar campo errado sem erro |
| 2 | Upload sem limite / sem backpressure / arquivo inteiro em memória | **CRÍTICO**: OOM, DoS, viola RNF02 |
| 3 | Arquivo parcial órfão ou registro inconsistente em falha | **ALTO**: lixo em disco, prontuário apontando para arquivo inexistente |
| 4 | Status code errado / erro vazando detalhe | **ALTO**: cliente não consegue tratar; vazamento de interno |
| 5 | Interface TS divergente do proto / opções de loader | **MÉDIO**: `undefined` em runtime, `int64` como string |
| 6 | Reflection, deadline, health | **MÉDIO/BAIXO** |

---

## Prioridade 1: compatibilidade do contrato (CRÍTICO)

Compare o `.proto` com a versão base (`git diff <base> -- src/proto`).

| Mudança | Compatível? |
|---------|-------------|
| Adicionar campo novo com número novo | ✅ |
| Adicionar RPC novo / mensagem nova | ✅ |
| Renomear campo mantendo número e tipo | ✅ no wire, mas ⚠️ quebra código gerado/JSON — avaliar |
| **Mudar número de campo** | ❌ |
| **Reaproveitar número de campo removido** | ❌ (dados antigos lidos como o campo novo) |
| **Mudar tipo** (`int32`→`string`, `string`→`bytes` em alguns casos, escalar→mensagem) | ❌ |
| Remover campo sem `reserved` número **e** nome | ❌ |
| Mover campo existente para dentro/fora de `oneof` | ❌ |
| Mudar `package` ou nome de `service`/`rpc` | ❌ (rota `/plexus.clinic.v1.ClinicalService/...` muda) |
| Trocar unary ↔ streaming | ❌ |

Checklist:

- [ ] Campo removido virou `reserved <n>; reserved "<nome>";`.
- [ ] Breaking change necessária → novo package `v2` em paralelo, não editar `v1`.
- [ ] Interface TS em `interfaces/` atualizada no **mesmo diff** (camelCase, `oneof` como opcionais).
- [ ] Cliente (frontend) avisado/atualizado quando o contrato muda.
- [ ] proto3 sem `optional`: `0`/`""`/`false` são indistinguíveis de "ausente" — a lógica considera isso?

## Prioridade 2: streaming de upload (CRÍTICO)

RNF01/RNF02: metadata no primeiro frame, chunks depois, sem carregar o arquivo inteiro na RAM, escrita via `fs.createWriteStream`.

- [ ] **Nenhum** acúmulo de chunks em array/`Buffer.concat` → Crítico (viola RNF02).
- [ ] Limite total de bytes checado **antes** de escrever cada chunk; acima do limite → abortar.
- [ ] `maxReceiveMessageLength` configurado (limita cada mensagem, não o total).
- [ ] Backpressure: `write()` retornando `false` aguarda `drain` (ou `for await` sobre o stream cru, ou `pipeline`). `@GrpcStreamMethod` + `subscribe` com `write` sem controle → Obrigatório para arquivos grandes.
- [ ] Primeiro frame validado (é `metadata`? DTO válido?) **antes** de abrir arquivo ou tocar o banco.
- [ ] Frame fora de ordem (chunk antes, metadata duplicada) → `INVALID_ARGUMENT`.
- [ ] Stream vazio → erro, não registro vazio.
- [ ] Cancelamento do cliente e erro no meio tratados (stream de escrita destruído).

## Prioridade 3: consistência em falha (ALTO)

- [ ] Arquivo escrito em path temporário; mover para final só após commit (ou `status` controlado em `medical_files`).
- [ ] Em qualquer erro após abrir o arquivo: `destroy()` + `rm(tmp)` no `catch`/`finally`.
- [ ] Banco não aponta para arquivo inexistente; disco não fica com arquivo sem registro (ou há rotina de limpeza documentada).
- [ ] Transação do banco **não** envolve o recebimento do stream (conexão presa por minutos).

## Prioridade 4: erros e status (ALTO)

- [ ] `RpcException({ code: status.X, message })` com status adequado (tabela em [nestjs-grpc/SKILL.md](../nestjs-grpc/SKILL.md#erros-grpc-núcleo)).
- [ ] Nada de `throw new Error()` cru chegando ao cliente como `UNKNOWN`.
- [ ] `HttpException`/`BadRequestException` em handler gRPC → Obrigatório (vira erro genérico).
- [ ] `@GrpcStreamCall`: erro convertido manualmente no `callback`, filter não cobre.
- [ ] Mensagem sem stack, SQL, path ou dado de paciente.

## Prioridade 5: loader e interfaces (MÉDIO)

- [ ] `keepCase` coerente com interfaces (camelCase ⇔ `keepCase: false`).
- [ ] `longs` coerente com o tipo do campo `int64` na interface (`Number` ⇔ `number`, `String` ⇔ `string`).
- [ ] `oneofs: true` quando o código lê o campo virtual do `oneof`.
- [ ] `protoPath` resolve em `dist` (asset copiado pelo `nest-cli.json`).
- [ ] `package` em `options` igual ao do `.proto`.

## Prioridade 6: operação (MÉDIO/BAIXO)

- [ ] Reflection (`@grpc/reflection`) desligado em produção.
- [ ] Credenciais: `createInsecure` só em dev; TLS em produção (ou no proxy).
- [ ] Chamadas gRPC de saída com timeout/deadline.
- [ ] Health check verificando banco e storage.
- [ ] `url`/porta via config, não hardcoded.

## Workflow

1. `git diff <base> -- src/proto` e classificar cada mudança na tabela de compatibilidade.
2. Conferir interface TS e opções de loader contra o proto.
3. Traçar o handler de stream frame a frame: primeiro frame, chunks, fim, erro, cancelamento.
4. Simular falha em cada passo (validação, disco, banco) e verificar limpeza.
5. Conferir status codes e mensagens.

## Output

Template de [SKILL.md](SKILL.md#template-de-output), citando o campo/RPC e o cenário concreto (ex.: "cliente v1 enviando campo 3 como string").
