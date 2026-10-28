# Revisão de concorrência e transações

Camada de [SKILL.md](SKILL.md). Revise código que usa transações TypeORM, locks, constraints `unique` sob concorrência e efeitos fora do banco (arquivo em disco, eventos). O foco é **ordem de execução entre chamadas concorrentes**, não estilo.

## Categorias de impacto

| Prioridade | Categoria | Impacto |
|---|---|---|
| 1 | Check-then-act sem proteção | **CRÍTICO**: duas chamadas decidem com o mesmo estado (paciente duplicado, erro 500 em vez de `ALREADY_EXISTS`) |
| 2 | Efeito fora do banco antes do commit / sem compensação | **CRÍTICO**: arquivo órfão, evento de registro que sofreu rollback |
| 3 | Escrita fora da transação | **ALTO**: `this.repo` usado dentro de `transaction()` não participa dela |
| 4 | Invariante não coberto em todos os entry points | **ALTO**: regra vale só no handler do diff |
| 5 | Early-return sem cleanup | **MÉDIO**: guard clause pula limpeza de temporário/estado |
| 6 | Assertion mais fraca que a garantia | **BAIXO**: teste passa sem provar o que o PR promete |

---

## Prioridade 1: check-then-act (CRÍTICO)

```ts
// ❌ dois uploads simultâneos do mesmo CPF
const existing = await this.patients.findOneBy({ documentCpf: cpf });
const patient = existing ?? (await this.patients.save({ documentCpf: cpf, fullName, phone }));
// A e B leem "não existe", ambos inserem → um estoura unique (23505) como INTERNAL.

// ✅ atômico no banco
await manager.upsert(PatientEntity, { documentCpf: cpf, fullName, phone }, ['documentCpf']);
const patient = await manager.findOneByOrFail(PatientEntity, { documentCpf: cpf });
// ✅ ou capturar 23505 e reler / mapear para ALREADY_EXISTS conforme a regra
```

Quando a decisão depende de estado atual (contagem, status) e precisa serializar:

```ts
await this.dataSource.transaction(async (manager) => {
  const record = await manager.findOne(ClinicalRecordEntity, {
    where: { id }, lock: { mode: 'pessimistic_write' },   // lock ANTES da decisão
  });
  if (!record) throw notFound();
  // decidir e escrever sob lock
});
```

### Checklist

- [ ] Toda verificação "existe?" seguida de insert está protegida por constraint + upsert/captura, ou lock.
- [ ] Lock vem **antes** da leitura que alimenta a decisão, não depois.
- [ ] Erro devolvido na corrida é semanticamente correto (`ALREADY_EXISTS`/`NOT_FOUND`, não `INTERNAL`).

## Prioridade 2: efeitos fora do banco (CRÍTICO)

Arquivo em disco e eventos não sofrem rollback.

```ts
// ❌ move o arquivo e só depois tenta o banco; falha no banco deixa arquivo "oficial" órfão
await rename(tmp, finalPath);
await this.dataSource.transaction(async (m) => { ... });

// ✅ banco primeiro, efeito depois, compensação em falha
try {
  const record = await this.dataSource.transaction(async (m) => persist(m, finalPath));
  await rename(tmp, finalPath);
  this.events.emit('clinical-record.created', { recordId: record.id }); // após commit
  return record;
} catch (err) {
  await rm(tmp, { force: true });
  throw err;
}
```

Se o `rename` falhar após o commit, o banco aponta para arquivo inexistente: usar `status` em `medical_files` (`uploading` → `stored`) ou rotina de reconciliação. Escolha documentada.

### Checklist

- [ ] Evento/notificação emitido só depois do commit.
- [ ] Arquivo temporário removido em toda falha.
- [ ] Estado intermediário (`status = uploading`) tem caminho de conclusão e de limpeza.
- [ ] Stream do upload **fora** da transação.

## Prioridade 3: escrita fora da transação (ALTO)

```ts
// ❌ this.records não usa a transação
await this.dataSource.transaction(async (manager) => {
  await manager.save(PatientEntity, p);
  await this.records.save(r);          // fora da transação!
});
// ✅
await manager.save(ClinicalRecordEntity, r);
```

- [ ] Dentro de `transaction(cb)`, só `manager`/`manager.getRepository(X)`.
- [ ] Métodos auxiliares chamados dentro da transação recebem o `manager`.
- [ ] `QueryRunner` manual: `release()` no `finally`, rollback no `catch`.

## Prioridade 4: invariante em todos os entry points (ALTO)

Regra nova (ex.: "todo prontuário tem ao menos um arquivo", "CPF normalizado") validada só no handler do diff. Grep por outros pontos que escrevem a mesma entity (outro RPC, rota HTTP, seed, script) e confirme que respeitam a regra — idealmente via constraint no banco ou método único de domínio.

- [ ] Listados todos os write-paths da entity/campo.
- [ ] Cada um respeita a regra ou há constraint no banco.

## Prioridade 5: early-return sem cleanup (MÉDIO)

```ts
// ❌ retorno antecipado esquece o temporário
if (totalBytes === 0) return { success: false } as RecordUploadResponse;
// ✅ limpar antes de sair (ou centralizar em finally)
```

- [ ] Guard clauses depois de abrir arquivo/transação liberam recursos.

## Prioridade 6: assertion fraca (BAIXO)

- [ ] O teste prova a garantia anunciada (ex.: "não deixa arquivo órfão" → teste verifica que o diretório temporário está vazio após falha).
- [ ] Precondição implícita (método só funciona chamado em certa ordem) documentada ou protegida.

## Workflow

1. Listar todos os write-paths da entity/invariante (não só o do diff).
2. Para cada um: ordem lock → leitura → decisão → escrita.
3. Para cada efeito fora do banco: ocorre após commit? há compensação?
4. Simular duas chamadas concorrentes (mesmo CPF, mesmo `recordId`).
5. Conferir early-returns e `finally`.
6. Conferir se os testes provam a garantia exata.

## Output

Template de [SKILL.md](SKILL.md#template-de-output), citando arquivo/símbolo e o **cenário de corrida concreto**.

## Fonte

Adaptado de `concurrency-review` (skills v11) para TypeORM/PostgreSQL e `db-use-transactions` (kadajett/agent-nestjs-skills).
