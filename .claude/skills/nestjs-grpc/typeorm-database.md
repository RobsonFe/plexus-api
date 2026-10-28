# TypeORM e PostgreSQL

Camada de [SKILL.md](SKILL.md). Carregar ao mexer em `*.entity.ts`, repositórios, queries, migrations ou transações.

Referência: [typeorm.io](https://typeorm.io) · [docs.nestjs.com/techniques/database](https://docs.nestjs.com/techniques/database)

## 1. Entities

Padrão já usado em `src/modules/clinical/entities/`:

```ts
@Entity({ name: 'medical_files' })
export class MedicalFileEntity {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  public recordId: string;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  public sizeBytes: string; // pg devolve bigint como string (ver regra abaixo)

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt: Date;

  @ManyToOne(() => ClinicalRecordEntity, (r) => r.medicalFiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  public clinicalRecord: ClinicalRecordEntity;
}
```

Regras:

- Tabela e colunas em **snake_case** via `name`; propriedades em camelCase.
- PK `uuid`; datas `timestamptz`.
- **`bigint` volta do driver `pg` como `string`.** Tipar a propriedade como `string` ou usar `transformer` para `number` — não declarar `number` sem transformer.
- `onDelete` explícito em toda relação: `CASCADE` só quando o filho não faz sentido sem o pai (e lembre que **arquivo em disco não é apagado pelo cascade** — precisa de limpeza explícita); `RESTRICT` quando apagar o pai deve falhar.
- Status como enum TS + `type: 'enum'` (ou `varchar` + union type), não string livre:
  ```ts
  export enum MedicalFileStatus { UPLOADING = 'uploading', STORED = 'stored', FAILED = 'failed' }
  @Column({ type: 'enum', enum: MedicalFileStatus, default: MedicalFileStatus.UPLOADING })
  ```
- `unique: true` em campos de identidade (`document_cpf`). Normalizar o CPF (só dígitos) **antes** de salvar, senão `123.456.789-00` e `12345678900` viram dois pacientes.
- Índice (`@Index`) só para colunas usadas em filtro/ordenação reais (FKs consultadas, `created_at` ordenado).
- Nunca `eager: true` em relações de coleção.

## 2. Migrations (não `synchronize`)

`synchronize: true` (hoje em `app.module.ts`) serve só para protótipo local: em produção pode **dropar colunas e dados**.

- Toda mudança de schema → migration gerada e revisada (`typeorm migration:generate` / `migration:create`).
- `synchronize: config.get('NODE_ENV') === 'development'` no máximo; `migrationsRun` controlado.
- Revisar migration: lock em tabela grande, backfill, `down()` reversível, `NOT NULL` em coluna existente precisa de default/backfill.

## 3. Onde a query mora

Hierarquia (ver [SKILL.md](SKILL.md#código-enxuto-onde-implementar)):

1. `Repository<T>` injetado direto no service para CRUD simples (`findOneBy`, `exists`, `save`, `insert`).
2. `QueryBuilder` **parametrizado** para consultas complexas (RNF04: "não usar ORM pesado para queries complexas" → QueryBuilder/SQL parametrizado, não cadeias de `relations` gigantes).
3. Custom repository/provider de queries só quando a mesma query complexa é usada em 2+ lugares.

```ts
// ✅ parametrizado
qb.where('p.document_cpf = :cpf', { cpf });
// ❌ injection
qb.where(`p.document_cpf = '${cpf}'`);
```

`query()` cru sempre com `$1, $2` + array de parâmetros.

## 4. Transações

Toda escrita multi-tabela que precisa ser atômica vai numa transação. O fluxo clínico (paciente → prontuário → arquivo) é o caso típico.

```ts
return this.dataSource.transaction(async (manager) => {
  const patient = await this.upsertPatient(manager, meta);
  const record = await manager.save(ClinicalRecordEntity, { patientId: patient.id, doctorNotes: meta.doctorNotes });
  await manager.insert(MedicalFileEntity, { recordId: record.id, diskPath, sizeBytes: String(total), status: MedicalFileStatus.STORED, ... });
  return record;
});
```

- Dentro da transação, **use só o `manager`** recebido; `this.repo` roda fora dela.
- Não fazer I/O lento (stream de 100MB) dentro da transação — segura conexão e locks. Receba o arquivo **antes**, abra a transação só para persistir.
- Efeitos fora do banco (mover arquivo, emitir evento) **depois** do commit; em falha, compensar (apagar arquivo temporário).
- `QueryRunner` manual só quando precisar controlar commit/rollback em etapas; sempre `release()` no `finally`.
- Concorrência (lock, unique race) → [review/concurrency-review.md](../review/concurrency-review.md).

### Upsert de paciente sem race

Dois uploads simultâneos do mesmo CPF não podem criar dois pacientes nem estourar erro genérico:

```ts
await manager.upsert(PatientEntity, { documentCpf: cpf, fullName, phone }, ['documentCpf']);
const patient = await manager.findOneByOrFail(PatientEntity, { documentCpf: cpf });
```

Ou capturar a violação de unique (`code === '23505'`) e mapear para `ALREADY_EXISTS`/reuso, conforme a regra de negócio.

## 5. N+1 e leitura eficiente

- ❌ Loop acessando relação carregada sob demanda / `findOne` por item.
- ✅ `relations: { medicalFiles: true }` ou `leftJoinAndSelect` numa query só; ou `In(ids)` em lote.
- `select` só das colunas necessárias em listagens.
- Toda listagem tem `take`/`skip` (ou cursor) com limite máximo.
- `exists({ where })` em vez de `count() > 0` / `findOne` só para checar existência.
- Escritas em lote: `insert([...])` / `save([...])` em array, não `save` em loop.

Revisão de performance: [review/typeorm-perf.md](../review/typeorm-perf.md).

## 6. Conexão

- Configuração via `TypeOrmModule.forRootAsync` + `ConfigService` (já existe). Sem defaults de credencial em produção.
- `autoLoadEntities: true` exige `TypeOrmModule.forFeature([...])` no módulo da feature.
- Pool (`extra: { max }`) dimensionado quando for para produção.

## Fonte

Adaptado de `db-use-transactions`, `db-avoid-n-plus-one`, `db-use-migrations`, `perf-optimize-database`, `arch-use-repository-pattern` (kadajett/agent-nestjs-skills) e `nestjs-expert` (jeffallan/claude-skills).
