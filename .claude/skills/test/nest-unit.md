# Testes unitários NestJS (por camada)

Referência para testar Service, Repository, Mapper e Controller com `@nestjs/testing`. Matriz completa: [scenarios.md](scenarios.md). Documentação: [docs.nestjs.com/fundamentals/testing](https://docs.nestjs.com/fundamentals/testing).

Specs ficam em `src/modules/<feature>/test/*.spec.ts` ([plexus-rules.md §3](../../rules/plexus-rules.md#3-arquitetura-modular-camadas-versão-híbrida)). Unit **nunca** usa banco real.

| Camada | Mocka | Real |
|--------|-------|------|
| Service | Repository do módulo (classe), cliente externo | Mapper, validação, stream, disco (tmp dir) |
| Repository | `Repository<T>` (`getRepositoryToken`) e `DataSource`/`manager` | lógica de query montada pelo repository |
| Mapper | nada | tudo (função pura) |
| Controller | Service | delegação e conversão de erro |

## 1. Service (repository mockado)

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ClinicalService', () => {
  let service: ClinicalService;
  let storageDir: string;
  const records = { saveRecordWithFile: jest.fn(), findForUser: jest.fn() };

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'plexus-test-'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicalService,
        { provide: ClinicalRecordRepository, useValue: records },
        { provide: ConfigService, useValue: { getOrThrow: (key: string) => ({ STORAGE_DIR: storageDir, MAX_FILE_BYTES: 1024 })[key] } },
      ],
    }).compile();
    service = moduleRef.get(ClinicalService);
    records.saveRecordWithFile.mockResolvedValue({ id: 'b3f1c2d4-0000-4000-8000-000000000001' });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await rm(storageDir, { recursive: true, force: true });
  });
});
```

Regras:

- Sempre `Test.createTestingModule`. Não instancie o service com `new` e mocks soltos: isso esconde erro de DI (provider faltando).
- O service depende do **repository do módulo** (classe), então o mock é por classe: `{ provide: ClinicalRecordRepository, useValue: ... }`. Nada de `getRepositoryToken` aqui — se o teste do service precisa dele, o service está importando TypeORM (violação de camada).
- Mapper **real** (função pura) — o teste confere a resposta final.
- `ConfigService` com valores pequenos (limite de 1024 bytes) para testar bordas sem alocar 100MB.
- `jest.clearAllMocks()` entre testes.

### Disco: diretório temporário real

Não mocke `fs`. Stream, backpressure e limpeza são exatamente o que precisa ser testado.

```ts
it('stores the file under a server-generated name', async () => {
  const res = await service.saveClinicalRecord(fakeUploadCall([{ metadata: { ...validMetadata, fileName: '../../evil.pdf' } }, chunk(512)]));

  const files = await readdir(storageDir);
  expect(files).toHaveLength(1);
  expect(files[0]).not.toContain('evil');
  expect(res).toEqual({ recordId: 'b3f1c2d4-0000-4000-8000-000000000001', totalBytes: 512, success: true });
});
```

### Assert de erro gRPC

```ts
const error = await service.saveClinicalRecord(call).catch((e: unknown) => e);

expect(error).toBeInstanceOf(RpcException);
expect((error as RpcException).getError()).toMatchObject({ code: status.INVALID_ARGUMENT });
```

Evite `rejects.toThrow()` sem conferir o `code`: qualquer `TypeError` também passaria. Mensagem: assertar só quando ela faz parte do contrato (PT-BR, sem ecoar valor sensível).

### Ordem de operações (validação antes do write)

```ts
it('does not persist anything when metadata is invalid', async () => {
  await service.saveClinicalRecord(fakeUploadCall([{ metadata: { ...validMetadata, patientCpf: '1' } }, chunk(10)])).catch(() => undefined);

  expect(records.saveRecordWithFile).not.toHaveBeenCalled(); // a chamada É o efeito aqui
  expect(await readdir(storageDir)).toEqual([]);
});
```

## 2. Repository (mock do TypeORM)

O repository é a única camada com TypeORM; o teste dele mocka o ORM e confere a query montada e o uso da transação.

```ts
describe('ClinicalRecordRepository', () => {
  let repository: ClinicalRecordRepository;
  const ormRecords = { findAndCount: jest.fn() };
  const manager = { upsert: jest.fn(), findOneByOrFail: jest.fn(), save: jest.fn(), insert: jest.fn() };
  const dataSource = { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicalRecordRepository,
        { provide: getRepositoryToken(ClinicalRecordEntity), useValue: ormRecords },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    repository = moduleRef.get(ClinicalRecordRepository);
  });

  it('paginates records of a patient with files in a single query', async () => {
    ormRecords.findAndCount.mockResolvedValue([[], 0]);

    await repository.findForPatient('p-1', { page: 2, limit: 10 });

    expect(ormRecords.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'p-1' }, relations: { medicalFiles: true }, take: 10, skip: 10 }),
    );
  });

  it('writes patient, record and file inside one transaction', async () => {
    manager.findOneByOrFail.mockResolvedValue({ id: 'p-1' });
    manager.save.mockResolvedValue({ id: 'r-1' });

    await repository.saveRecordWithFile(newRecordData);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledWith(MedicalFileEntity, expect.objectContaining({ recordId: 'r-1', sizeBytes: '1024' }));
  });
});
```

- `DataSource.transaction` mockado **executando o callback**, para a lógica dentro da transação rodar de verdade.
- Aqui o assert nos argumentos do ORM é legítimo: a query **é** o comportamento do repository (paginação, `relations` contra N+1, uso do `manager`).
- Regras de negócio não aparecem neste teste — se aparecem, estão na camada errada.
- Comportamento real de SQL (constraint `unique`, `upsert`) é coberto no **e2e** com banco de teste ([grpc.md](grpc.md)).

## 3. Mapper (puro)

```ts
it('maps the record to the upload response without internal fields', () => {
  const res = ClinicalRecordMapper.toUploadResponse({ id: 'r-1', diskPath: '/var/plexus/x.pdf' } as ClinicalRecordEntity, 2048);

  expect(res).toEqual({ recordId: 'r-1', totalBytes: 2048, success: true });
});
```

Só teste mapper com conversão relevante (`bigint`, datas, remoção de campo sensível). Mapper trivial já é coberto pelo teste do service.

## 4. Controller (delegação)

```ts
it('delegates to the service and passes the gRPC error to the callback', async () => {
  const service = { saveClinicalRecord: jest.fn().mockRejectedValue(new RpcException({ code: status.INVALID_ARGUMENT, message: 'O primeiro frame deve conter os metadados' })) };
  const moduleRef = await Test.createTestingModule({
    controllers: [ClinicalController],
    providers: [{ provide: ClinicalService, useValue: service }],
  }).compile();
  const callback = jest.fn();

  moduleRef.get(ClinicalController).saveClinicalRecord(fakeUploadCall([]), callback);
  await new Promise(setImmediate);

  expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: status.INVALID_ARGUMENT }), null);
});
```

## 5. Validação de DTO isolada (quando há regra própria)

```ts
it.each(['', '123', '1234567890a'])('rejects cpf %p', async (cpf) => {
  const errors = await validate(plainToInstance(ClinicalMetadataDto, { ...validMetadata, patientCpf: cpf }));
  expect(errors.map((e) => e.property)).toContain('patientCpf');
});
```

Só para validador próprio (ex.: `@IsCpf()`). Decorator padrão do `class-validator` não precisa de teste dedicado.

## 6. Guards e filters

- Guard: chame `canActivate` com um `ExecutionContext` falso que devolve `Metadata` em `switchToRpc().getContext()`; asserte `UNAUTHENTICATED` sem token e `true` com token válido.
- Filter: chame `catch(exception, host)` e asserte o `{ code, message }` emitido; erro desconhecido → `INTERNAL` com mensagem genérica em PT-BR.

## Mock

- Fronteira de cada camada (tabela no topo). `Date`/timers com `jest.useFakeTimers()` quando houver timeout.
- **Não** mockar o próprio código sob teste nem a validação.
- **Não** assertar só que o mock foi chamado — assertar resposta e estado (ver [good-tests.md](good-tests.md)); exceções: repository (a query é o efeito) e controller (o callback é a saída).
- Mocks tipados (`jest.Mocked<Pick<ClinicalRecordRepository, 'saveRecordWithFile'>>`), sem `as any`.
- Fixtures (`fakeUploadCall`, `chunk`, `validMetadata`, `newRecordData`) em `src/modules/<feature>/test/fixtures.ts`, só com dados fictícios.

Voltar: [SKILL.md](SKILL.md).
