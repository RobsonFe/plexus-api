# Testes gRPC e e2e

Referência para testar handlers gRPC (unary e streaming), status codes e o app inteiro com um cliente gRPC real. Matriz completa: [scenarios.md](scenarios.md). Implementação de referência: [nestjs-grpc/grpc-microservices.md](../nestjs-grpc/grpc-microservices.md).

## Stream falso (unit)

`@GrpcStreamCall` recebe o `ServerReadableStream` do `grpc-js`, que é um `Readable` em object mode. Em teste, um `Readable.from` cobre o caso:

```ts
import { Readable } from 'node:stream';
import type { ServerReadableStream } from '@grpc/grpc-js';

export const chunk = (size: number) => ({ chunk: { data: Buffer.alloc(size, 1) } });

export function fakeUploadCall(frames: RecordUploadStream[]) {
  return Readable.from(frames) as unknown as ServerReadableStream<RecordUploadStream, RecordUploadResponse>;
}
```

Erro ou cancelamento no meio do stream:

```ts
function failingCall(frames: RecordUploadStream[], error: Error) {
  return Readable.from((async function* () {
    yield* frames;
    throw error; // simula conexão caindo / cliente cancelando
  })()) as unknown as ServerReadableStream<RecordUploadStream, RecordUploadResponse>;
}
```

`@GrpcStreamMethod` recebe `Observable`: use `from([...])` do RxJS ou um `Subject` para emitir e errar no meio (`subject.error(new Error('cancelled'))`).

Guarde `fakeUploadCall`, `chunk` e `validMetadata` (com CPF **fictício**) num helper de teste do módulo (ex.: `src/modules/clinical/testing/fixtures.ts`), nunca em código de produção.

## Handler (controller) unit

O controller é fino, então o teste dele é curto: confirma que o `callback` recebe o resultado ou o erro **gRPC** traduzido.

```ts
it('passes a gRPC error to the callback when the service fails', async () => {
  clinicalService.handleUpload.mockRejectedValueOnce(new RpcException({ code: status.INVALID_ARGUMENT, message: 'x' }));
  const callback = jest.fn();

  controller.saveClinicalRecord(fakeUploadCall([]), callback);
  await new Promise(setImmediate);

  expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: status.INVALID_ARGUMENT }), null);
});
```

Aqui o assert no mock é legítimo: o `callback` **é** a saída do handler.

## E2E com cliente gRPC real

Sobe o app com o microservice gRPC numa porta de teste e chama via `@grpc/grpc-js`, com o **mesmo** `.proto` e as mesmas opções de loader de produção.

```ts
import { credentials, loadPackageDefinition, Metadata, ServiceClientConstructor, type Client } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

const PROTO_PATH = join(__dirname, '../src/proto/clinical.proto');
const URL = 'localhost:50099';

describe('ClinicalService (e2e gRPC)', () => {
  let app: INestApplication;
  let client: Client & Record<string, Function>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>(
      { transport: Transport.GRPC, options: { ...grpcOptions, url: URL } },
      { inheritAppConfig: true },
    );
    await app.startAllMicroservices();
    await app.init();

    const pkg = loadPackageDefinition(loadSync(PROTO_PATH, { keepCase: false, longs: Number, oneofs: true })) as unknown as {
      plexus: { clinic: { v1: { ClinicalService: ServiceClientConstructor } } };
    };
    client = new pkg.plexus.clinic.v1.ClinicalService(URL, credentials.createInsecure()) as typeof client;
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('stores a record sent as metadata + chunks', async () => {
    const res = await new Promise<RecordUploadResponse>((resolve, reject) => {
      const call = client.saveClinicalRecord(new Metadata(), (err: Error | null, value: RecordUploadResponse) =>
        err ? reject(err) : resolve(value),
      );
      call.write({ metadata: validMetadata });
      call.write({ chunk: { data: Buffer.alloc(1024) } });
      call.end();
    });

    expect(res).toMatchObject({ totalBytes: 1024, success: true });
    // conferir linha no banco de teste e arquivo no STORAGE_DIR de teste
  });

  it('returns INVALID_ARGUMENT when the first frame is a chunk', async () => {
    const err = await new Promise<{ code: number }>((resolve) => {
      const call = client.saveClinicalRecord(new Metadata(), (e: { code: number }) => resolve(e));
      call.write({ chunk: { data: Buffer.alloc(10) } });
      call.end();
    });

    expect(err.code).toBe(status.INVALID_ARGUMENT);
  });
});
```

Regras do e2e:

- **Banco de teste isolado**: PostgreSQL do `docker-compose.yml` com database próprio (`DB_DATABASE=plexusdb_test`) ou container efêmero. Nunca o banco de dev.
- **Storage de teste**: `STORAGE_DIR` apontando para diretório temporário, limpo no `afterAll`.
- Limpar tabelas entre testes (`TRUNCATE ... CASCADE` via `DataSource`) para que um teste não dependa do outro.
- Porta fixa e distinta da de dev (ou porta livre obtida antes do `connectMicroservice`).
- Reflection pode ficar ligado no e2e; não assertar comportamento que dependa dele.
- Use as mesmas opções de loader, pipes e filters de produção (extraia `grpcOptions` para um módulo compartilhado em vez de duplicar).

## E2E HTTP (rotas REST do app híbrido)

Padrão já usado em `test/app.e2e-spec.ts`:

```ts
await request(app.getHttpServer())
  .get('/api/v1/records/<uuid>')
  .set('Authorization', `Bearer ${token}`)
  .expect(404);
```

Assertar status **e** corpo (e estado do banco em escrita), não só o status.

## Mock

- No e2e, mock só o que é externo ao serviço (outros serviços gRPC, provedores). Banco e disco são reais (de teste).
- **Não** mockar o service dentro do e2e — aí ele vira unit disfarçado.

Voltar: [SKILL.md](SKILL.md).
