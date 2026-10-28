# TypeORM, Repository e Mapper

Camada de [SKILL.md](SKILL.md). Carregar ao mexer em `*.entity.ts`, `repository/`, `mapper/`, queries, migrations ou transações. Regras obrigatórias: [plexus-rules.md §4–6](../../rules/plexus-rules.md#6-typeorm).

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
  public sizeBytes: string; // pg devolve bigint como string; o mapper converte

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
- **`bigint` volta do driver `pg` como `string`.** Tipar como `string` e converter no mapper (ou `transformer`), não declarar `number` sem conversão.
- `onDelete` explícito: `CASCADE` só quando o filho não faz sentido sem o pai (o cascade **não apaga o arquivo em disco** — limpeza explícita no service); `RESTRICT` quando apagar o pai deve falhar.
- Status como enum TS + `type: 'enum'`, não string livre:
  ```ts
  export enum MedicalFileStatus { UPLOADING = 'uploading', STORED = 'stored', FAILED = 'failed' }
  @Column({ type: 'enum', enum: MedicalFileStatus, default: MedicalFileStatus.UPLOADING })
  ```
- `unique: true` em identidade (`document_cpf`). Normalizar o CPF (só dígitos) no DTO **antes** de chegar ao repository.
- `@Index` só em colunas usadas em filtro/ordenação reais. Nunca `eager: true` em coleção.
- Entity não sai do service: o mapper converte para a mensagem proto.

## 2. Migrations (não `synchronize`)

`synchronize: true` (hoje em `app.module.ts`) serve só para protótipo local: em produção pode **dropar colunas e dados**.

- Toda mudança de schema → migration gerada e revisada.
- `synchronize` no máximo em `NODE_ENV=development`.
- Revisar: lock em tabela grande, backfill, `down()` reversível, `NOT NULL` em coluna existente com default/backfill.

## 3. Repository: única camada com TypeORM

O service **nunca** importa `typeorm`. Toda query vive no repository do módulo, exposta como **método de domínio**.

```ts
@Injectable()
export class ClinicalRecordRepository {
  constructor(
    @InjectRepository(ClinicalRecordEntity) private readonly records: Repository<ClinicalRecordEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca os prontuários de um paciente com os arquivos, paginados.
   *
   * @param patientId Id do paciente
   * @param page Página (1-based) e limite
   * @returns Prontuários da página e o total
   */
  findForPatient(patientId: string, page: PageRequest): Promise<[ClinicalRecordEntity[], number]> {
    return this.records.findAndCount({
      where: { patientId },
      relations: { medicalFiles: true },
      order: { createdAt: 'DESC' },
      take: page.limit,
      skip: (page.page - 1) * page.limit,
    });
  }
}
```

- ✅ Métodos com nome de domínio e query completa dentro.
- ❌ `findById(id) { return this.repo.findOneBy({ id }) }` repassando sem agregar nada — exponha o método que o caso de uso precisa (ex.: `findForUser(recordId, userId)`).
- ❌ Regra de negócio no repository (limites, permissões, decisões de status) — isso é do service.
- Consultas complexas (RNF04: "sem ORM pesado em queries complexas"): `QueryBuilder` **parametrizado** ou `query()` com `$1, $2`.

```ts
qb.where('p.document_cpf = :cpf', { cpf });  // ✅
qb.where(`p.document_cpf = '${cpf}'`);       // ❌ injection
```

## 4. Transações: o service pede, o repository executa

O repository expõe um método **atômico** que roda tudo numa transação. O service decide **quando** chamá-lo (depois de receber o arquivo).

```ts
// repository
/**
 * Cria (ou reaproveita) o paciente, o prontuário e o registro do arquivo numa transação.
 *
 * @param data Dados validados do paciente, notas e arquivo já gravado em disco
 * @returns Prontuário criado
 */
saveRecordWithFile(data: NewClinicalRecord): Promise<ClinicalRecordEntity> {
  return this.dataSource.transaction(async (manager) => {
    await manager.upsert(PatientEntity, { documentCpf: data.cpf, fullName: data.fullName, phone: data.phone }, ['documentCpf']);
    const patient = await manager.findOneByOrFail(PatientEntity, { documentCpf: data.cpf });
    const record = await manager.save(ClinicalRecordEntity, { patientId: patient.id, doctorNotes: data.doctorNotes });
    await manager.insert(MedicalFileEntity, {
      recordId: record.id,
      originalName: data.originalName,
      mimeType: data.mimeType,
      diskPath: data.diskPath,
      sizeBytes: String(data.sizeBytes),
      status: MedicalFileStatus.STORED,
    });
    return record;
  });
}
```

```ts
// service — sem TypeORM
const record = await this.records.saveRecordWithFile({ ...metadata, diskPath, sizeBytes: totalBytes });
return ClinicalRecordMapper.toUploadResponse(record, totalBytes);
```

- Dentro da transação, **só o `manager`**; `this.records` roda fora dela.
- Nada de I/O lento (stream de 100MB) dentro da transação: receba o arquivo antes.
- Efeitos fora do banco (mover arquivo, emitir evento) **depois** do commit; em falha, o service compensa (apaga o temporário).
- `upsert` evita a corrida de dois uploads simultâneos com o mesmo CPF. Detalhe: [review/concurrency-review.md](../review/concurrency-review.md).
- `QueryRunner` manual só quando precisar controlar etapas; sempre `release()` no `finally`.

## 5. Mapper

Converte entity → mensagem proto (e dados de entrada → formato de persistência quando necessário). Sem DI, sem I/O, sem regra.

```ts
export class ClinicalRecordMapper {
  /**
   * Converte o prontuário na mensagem de resumo do upload.
   *
   * @param record Prontuário persistido
   * @param totalBytes Total de bytes recebidos no stream
   * @returns Mensagem `RecordUploadResponse`
   */
  static toUploadResponse(record: ClinicalRecordEntity, totalBytes: number): RecordUploadResponse {
    return { recordId: record.id, totalBytes, success: true };
  }
}
```

- `bigint` (string do `pg`) → `number`/`string` conforme o `longs` do loader; `Date` → ISO string ou `google.protobuf.Timestamp`.
- Remove campos internos/sensíveis (`diskPath`, notas em listagem).
- Só crie métodos de mapper que algum RPC usa. Nada de `toEntity`/`toDto` "para completar".

## 6. N+1 e leitura eficiente

- ❌ Loop com `findOne` por item ou relação lazy acessada em loop.
- ✅ `relations: { medicalFiles: true }` / `leftJoinAndSelect` numa query, ou `In(ids)` em lote.
- `select` só das colunas necessárias em listagens (evite `doctor_notes` em lista).
- Toda listagem com `take`/`skip` e teto no servidor.
- `exists({ where })` em vez de `count() > 0`.
- Escritas em lote: `insert([...])`/`save([...])`, não `save` em loop.

Revisão de performance: [review/typeorm-perf.md](../review/typeorm-perf.md).

## 7. Conexão

- `TypeOrmModule.forRootAsync` + `ConfigService` (já existe). Sem defaults de credencial em produção.
- `autoLoadEntities: true` exige `TypeOrmModule.forFeature([...])` no módulo da feature.
- Pool (`extra: { max }`) dimensionado para produção.

## Fonte

Adaptado de `db-use-transactions`, `db-avoid-n-plus-one`, `db-use-migrations`, `perf-optimize-database`, `arch-use-repository-pattern` (kadajett/agent-nestjs-skills), `nestjs-expert` (jeffallan/claude-skills) e das regras de camadas do Plexus.
