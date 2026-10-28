# Testes unitários NestJS

Referência para testar services e providers com `@nestjs/testing`. Matriz completa: [scenarios.md](scenarios.md). Documentação: [docs.nestjs.com/fundamentals/testing](https://docs.nestjs.com/fundamentals/testing).

## Setup típico

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ClinicalService', () => {
  let service: ClinicalService;
  let storageDir: string;
  const manager = { upsert: jest.fn(), findOneByOrFail: jest.fn(), save: jest.fn(), insert: jest.fn() };
  const dataSource = { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'plexus-test-'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicalService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(PatientEntity), useValue: { findOneBy: jest.fn() } },
        { provide: ConfigService, useValue: configWith({ STORAGE_DIR: storageDir, MAX_FILE_BYTES: 1024 }) },
      ],
    }).compile();
    service = moduleRef.get(ClinicalService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await rm(storageDir, { recursive: true, force: true });
  });
});
```

Regras:

- Sempre `Test.createTestingModule`. Não instancie o service com `new` e mocks soltos: isso esconde erro de DI (token errado, provider faltando).
- `getRepositoryToken(Entity)` para repositórios injetados com `@InjectRepository`.
- `DataSource.transaction` mockado **executando o callback** com um `manager` falso; assim a lógica dentro da transação roda de verdade.
- `ConfigService` com valores pequenos (limite de 1024 bytes) para testar bordas sem alocar 100MB.
- `jest.clearAllMocks()` entre testes; nada de estado vazando de um teste para o outro.

## Disco: diretório temporário real

Não mocke `fs`. A lógica de stream, backpressure e limpeza é exatamente o que precisa ser testado.

```ts
it('stores the file under a server-generated name', async () => {
  const res = await service.handleUpload(fakeUploadCall([{ metadata: { ...validMetadata, fileName: '../../evil.pdf' } }, chunk(512)]));

  const files = await readdir(storageDir);
  expect(files).toHaveLength(1);
  expect(files[0]).not.toContain('evil');
  expect(res.totalBytes).toBe(512);
});
```

## Assert de erro gRPC

```ts
const error = await service.handleUpload(call).catch((e: unknown) => e);

expect(error).toBeInstanceOf(RpcException);
expect((error as RpcException).getError()).toMatchObject({ code: status.INVALID_ARGUMENT });
```

Evite `rejects.toThrow()` sem conferir o `code`: qualquer `TypeError` também passaria.

## Ordem de operações (validação antes do write)

O teste deve falhar se o service gravar antes de validar:

```ts
it('does not open a transaction when metadata is invalid', async () => {
  await service.handleUpload(fakeUploadCall([{ metadata: { ...validMetadata, patientCpf: '1' } }, chunk(10)])).catch(() => undefined);

  expect(dataSource.transaction).not.toHaveBeenCalled(); // a chamada É o efeito aqui
  expect(await readdir(storageDir)).toEqual([]);
});
```

## Validação de DTO isolada (quando há regra própria)

```ts
it.each(['', '123', '1234567890a'])('rejects cpf %p', async (cpf) => {
  const errors = await validate(plainToInstance(ClinicalMetadataDto, { ...validMetadata, patientCpf: cpf }));
  expect(errors.map((e) => e.property)).toContain('patientCpf');
});
```

Só para validador próprio (ex.: `@IsCpf()`). Decorator padrão do `class-validator` não precisa de teste dedicado.

## Guards e filters

- Guard: chame `canActivate` com um `ExecutionContext` falso que devolve `Metadata` em `switchToRpc().getContext()`; asserte `UNAUTHENTICATED` sem token e `true` com token válido.
- Filter: chame `catch(exception, host)` e asserte o objeto `{ code, message }` emitido; erro desconhecido → `INTERNAL` com mensagem genérica.

## Mock

- Fronteira: Repository/`DataSource`, cliente gRPC externo (`ClientGrpc`), `Date`/timers (`jest.useFakeTimers()` quando houver timeout).
- **Não** mockar o próprio service sob teste nem a validação.
- **Não** assertar só que o mock foi chamado — assertar resposta e estado (ver [good-tests.md](good-tests.md)).
- Mocks tipados: `jest.Mocked<Pick<Repository<PatientEntity>, 'findOneBy'>>`, sem `as any`.

Voltar: [SKILL.md](SKILL.md).
