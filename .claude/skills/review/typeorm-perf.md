# Revisão de performance TypeORM

Camada de [SKILL.md](SKILL.md). Carregar quando o diff toca entities, `find*`, `QueryBuilder`, listagens ou escritas em lote.

Implementação de referência: [nestjs-grpc/typeorm-database.md](../nestjs-grpc/typeorm-database.md).

## Abordagem

Encontre problemas que **importam em escala**, não micro-otimizações. Cada achado precisa de: impacto concreto, cenário em que acontece e correção.

## Categorias de impacto

| Prioridade | Categoria | Impacto |
|---|---|---|
| 1 | N+1 | **CRÍTICO**: queries crescem linearmente com os dados |
| 2 | Consulta sem limite / arquivo em memória | **CRÍTICO**: OOM, timeout |
| 3 | Índice ausente em filtro/ordenação frequente | **ALTO**: full scan em tabela grande |
| 4 | Escrita em loop | **ALTO**: N round trips |
| 5 | Padrões ineficientes | **BAIXO** |

---

## Prioridade 1: N+1 (CRÍTICO)

```ts
// ❌ 1 query + 1 por prontuário
const records = await this.records.find({ where: { patientId } });
for (const r of records) {
  r.medicalFiles = await this.files.findBy({ recordId: r.id });
}
// ✅ uma query
const records = await this.records.find({ where: { patientId }, relations: { medicalFiles: true } });
// ✅ ou lote
const files = await this.files.findBy({ recordId: In(records.map((r) => r.id)) });
```

- [ ] Nenhum `await` de query dentro de `for`/`map` sobre resultados.
- [ ] Relações lazy (`Promise<T>`) acessadas em loop.
- [ ] `relations` profundas que explodem o join (produto cartesiano em duas coleções) → separar em duas queries.
- [ ] Nunca `eager: true` em coleção.

## Prioridade 2: sem limite (CRÍTICO)

- [ ] `find()` de listagem sem `take` → Crítico em tabela que cresce (`clinical_records`, `medical_files`).
- [ ] `take` com teto no servidor (cliente não pede 1.000.000).
- [ ] Ordenação estável (`created_at`, `id`) para paginação.
- [ ] Processamento em massa: paginar em lotes ou `stream()` do QueryBuilder, não carregar tudo.
- [ ] Arquivo: nunca `readFile`/`Buffer.concat` de arquivo médico inteiro — stream (RNF02).

## Prioridade 3: índices (ALTO)

- [ ] FKs consultadas (`patient_id`, `record_id`) indexadas — PostgreSQL **não** cria índice automático em FK.
- [ ] `document_cpf` com `unique` (já gera índice).
- [ ] Coluna em `ORDER BY` de listagem grande indexada; índice composto quando filtro + ordenação andam juntos (`(patient_id, created_at)`).
- [ ] Sem índice especulativo em coluna nunca filtrada (custo de escrita).

```ts
@Index(['patientId', 'createdAt'])
@Entity({ name: 'clinical_records' })
```

## Prioridade 4: escrita em loop (ALTO)

```ts
// ❌
for (const f of files) await this.files.save(f);
// ✅
await this.files.insert(files);        // ou save(files) em array
// ✅ update em massa
await this.files.update({ recordId }, { status: MedicalFileStatus.FAILED });
```

- [ ] `save`/`delete`/`update` em loop → em lote.
- [ ] `save` usado onde `insert` basta (`save` faz SELECT antes para decidir insert/update).

## Prioridade 5: padrões ineficientes (BAIXO)

- `count() > 0` / `findOne` só para existência → `exists({ where })`.
- Selecionar todas as colunas (incluindo `doctor_notes` TEXT grande) em listagem → `select`.
- `findOne` repetido do mesmo registro na mesma requisição → reutilizar.

## O que NÃO reportar

- Uma query extra fixa (2 queries ao invés de 1) → no máximo BAIXO.
- `relations` em busca de **um** registro por id.
- Micro-diferenças sem volume real.
- Tabelas pequenas e limitadas por natureza.

## Formato de saída

```markdown
## Performance TypeORM: [arquivo/componente]

### Resumo
[n] achados: [x] Crítico, [y] Alto, [z] Baixo

### Achados
- Crítico: [arquivo:linha] N+1 em `listRecords` — 1 + N queries para N prontuários. Correção: `relations: { medicalFiles: true }`.
```

Para entrar no relatório principal, converter para o template de [SKILL.md](SKILL.md#template-de-output).

## Fonte

Adaptado de `django-perf` (skills v11) para TypeORM, e `db-avoid-n-plus-one`, `perf-optimize-database` (kadajett/agent-nestjs-skills).
