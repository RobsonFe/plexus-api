# Matriz de cenários (obrigatória em fix/feature)

Carregue esta camada **sempre** que houver fix ou feature nova. Orquestrador: [SKILL.md](SKILL.md).

## Antes de codar o teste

1. Listar os ramos do handler/service (happy path, cada `throw`, cada `catch`, cada guarda `if`, cada evento do stream).
2. Marcar qual teste cobre cada ramo.
3. No resumo do PR, incluir tabela **ramo → teste** (ou ramo omitido + motivo).

## Matriz por RPC gRPC

Cada linha aplicável vira **ao menos um** teste:

| Cenário | O que assertar |
|---------|----------------|
| Caminho feliz | Resposta com campos derivados **à mão** (`totalBytes`, `success`); linha no banco; arquivo no disco com o tamanho certo |
| Sem credencial | `code = UNAUTHENTICATED`, nada persistido |
| Sem permissão | `code = PERMISSION_DENIED`, **nenhum** efeito no banco ou disco |
| Recurso de outro usuário | `code = NOT_FOUND` (não revelar existência) |
| Validação | `code = INVALID_ARGUMENT`, mensagem cita o campo e **não** ecoa o valor (CPF) |
| Recurso inexistente | `code = NOT_FOUND` com UUID válido que não existe |
| Duplicidade (`unique`) | comportamento definido (reuso ou `ALREADY_EXISTS`), sem duplicata no banco |
| Transação multi-step | falha no meio → rollback, nada pela metade |
| Fronteira externa | banco/disco/cliente gRPC externo falha → `INTERNAL` genérico, sem stack/SQL/path na mensagem |
| Bordas | string vazia, `undefined` no `oneof`, limite exato vs limite + 1, `int64`, datas `timestamptz` |

## Matriz específica de client streaming (upload clínico)

RNF01/RNF02/RF03 de [docs/CONTEXT.md](../../../docs/CONTEXT.md):

| Cenário | Esperado |
|---------|----------|
| metadata + N chunks válidos | registro criado; arquivo no disco com `totalBytes` correto |
| primeiro frame é chunk | `INVALID_ARGUMENT`, nada persistido, nenhum arquivo |
| metadata duas vezes | `INVALID_ARGUMENT` |
| stream vazio | `INVALID_ARGUMENT` |
| só metadata, sem chunks | comportamento definido (arquivo vazio rejeitado?) |
| CPF inválido / MIME fora da allowlist | `INVALID_ARGUMENT` **antes** de escrever em disco |
| soma dos chunks = limite (100MB) | aceito |
| soma dos chunks = limite + 1 byte | erro de tamanho; temporário removido |
| falha no banco após gravar arquivo | `INTERNAL`; temporário removido |
| cliente cancela no meio | recursos liberados; nada persistido |
| `fileName` com `../` | arquivo salvo dentro do storage com nome gerado pelo servidor |

Para testar limite sem alocar 100MB: injetar o limite via `ConfigService` mockado (ex.: 1024 bytes).

## Blocos dentro da função (unit)

- Cada `throw` explícito: teste dispara e verifica o **`code`** gRPC (ou a classe do erro de domínio).
- Cada `try/catch`: caminho com exceção (limpeza/log/re-throw) e caminho sem.
- Cada guarda (early return): teste que entra e que não entra.
- Ordem: teste que **falharia** se a validação ou a autorização viessem **depois** do write.

## `it.each` para validação

Expected **literal** — nunca calculado pelo código sob teste:

```ts
it.each([
  [{ patientCpf: '' }, 'patientCpf'],
  [{ patientCpf: '123' }, 'patientCpf'],
  [{ fileMimeType: 'application/x-msdownload' }, 'fileMimeType'],
  [{ doctorNotes: 'x'.repeat(20_001) }, 'doctorNotes'],
])('rejects invalid metadata %o', async (override, field) => {
  const call = fakeUploadCall([{ metadata: { ...validMetadata, ...override } }, chunk(10)]);

  const error = await service.saveClinicalRecord(call).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(RpcException);
  expect((error as RpcException).getError()).toMatchObject({ code: status.INVALID_ARGUMENT });
  expect(JSON.stringify((error as RpcException).getError())).toContain(field);
  expect(await readdir(storageDir)).toEqual([]);
});
```

## Falha na fronteira (`try/catch`)

```ts
it('removes temp file and returns INTERNAL when the database fails', async () => {
  records.saveRecordWithFile.mockRejectedValueOnce(new Error('connection lost'));

  const error = await service.saveClinicalRecord(fakeUploadCall([{ metadata: validMetadata }, chunk(64)])).catch((e: unknown) => e);

  expect((error as RpcException).getError()).toMatchObject({ code: status.INTERNAL });
  expect(JSON.stringify((error as RpcException).getError())).not.toContain('connection lost');
  expect(await readdir(storageDir)).toEqual([]);
});
```

## Checklist de saída (PR)

```markdown
## Matriz de testes
| Ramo | Teste | Observação |
|------|-------|------------|
| upload happy path | `stores file and record` | |
| chunk antes de metadata | `rejects chunk before metadata` | |
| metadata inválida | `rejects invalid metadata` | it.each |
| limite + 1 byte | `rejects file above limit` | limite via config |
```
