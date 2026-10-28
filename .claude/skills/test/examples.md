# Exemplos — test

## Fix: chunk antes de metadata derrubava o handler

**Comportamento que quebrava:** se o cliente mandasse um `chunk` no primeiro frame, o service tentava escrever num `WriteStream` ainda `undefined` → `TypeError` → cliente recebia `UNKNOWN`.

**Testes:**

```ts
// src/modules/clinical/clinical.service.spec.ts — unit
it('rejects a chunk sent before metadata', async () => {
  const error = await service.handleUpload(fakeUploadCall([chunk(10)])).catch((e: unknown) => e);

  expect((error as RpcException).getError()).toMatchObject({ code: status.INVALID_ARGUMENT });
  expect(await readdir(storageDir)).toEqual([]);
});
```

```ts
// test/clinical.e2e-spec.ts — e2e
it('returns INVALID_ARGUMENT when the first frame is a chunk', async () => { /* ver grpc.md */ });
```

**Comando:**

```powershell
npm test -- src/modules/clinical/clinical.service.spec.ts
npm run test:e2e -- test/clinical.e2e-spec.ts
```

## Feature: upload clínico por client streaming (RF01–RF03, RNF01–RNF03)

Ver [grpc.md](grpc.md), [nest-unit.md](nest-unit.md) e a matriz de streaming em [scenarios.md](scenarios.md).

**Mínimo sugerido (unit, `ClinicalService`):**

- `stores file and record for metadata followed by chunks`
- `rejects a chunk sent before metadata`
- `rejects metadata sent twice`
- `rejects an empty stream`
- `rejects invalid metadata` (`it.each`: CPF, MIME, notas acima do limite)
- `rejects a file one byte above the limit` (limite pequeno via `ConfigService`)
- `removes temp file and returns INTERNAL when the database fails`
- `stores the file under a server-generated name` (`fileName` com `../`)
- `reuses the patient when the cpf already exists` (ou `ALREADY_EXISTS`, conforme a regra)

**Mínimo sugerido (e2e):**

- caminho feliz completo (resposta + linha no banco + arquivo no storage de teste)
- primeiro frame inválido → `INVALID_ARGUMENT`

## PR / resumo — bloco sugerido

```markdown
## Testes
- Arquivos: `src/modules/clinical/clinical.service.spec.ts`, `test/clinical.e2e-spec.ts`
- Matriz ramo → teste: (tabela de scenarios.md)
- Comandos: `npm test -- src/modules/clinical` · `npm run test:e2e`
- Resultado: N passed, 0 failed
```
