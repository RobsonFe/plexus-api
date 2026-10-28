# gRPC no NestJS (Plexus)

Camada de [SKILL.md](SKILL.md). Carregar ao mexer em `.proto`, controllers gRPC, bootstrap do microservice ou upload por streaming.

Referência oficial: [docs.nestjs.com/microservices/grpc](https://docs.nestjs.com/microservices/grpc) · [protobuf.dev/programming-guides/proto3](https://protobuf.dev/programming-guides/proto3/)

## 1. Contrato proto3

```proto
syntax = "proto3";
package plexus.clinic.v1;

service ClinicalService {
  rpc SaveClinicalRecord (stream RecordUploadStream) returns (RecordUploadResponse);
}

message RecordUploadStream {
  oneof payload {
    ClinicalMetadata metadata = 1;
    FileChunk chunk = 2;
  }
}
```

Regras:

- **Field numbers são o contrato**, não os nomes. Nunca renumerar, nunca reaproveitar número de campo removido.
- Campo removido → `reserved 3; reserved "old_name";`.
- Mudar tipo de campo (ex.: `int32` → `string`) é breaking. Crie campo novo.
- `oneof` para mensagens "ou isto ou aquilo" (metadata **ou** chunk). Não adicione campo existente a um `oneof` depois.
- Números 1–15 usam 1 byte: reserve-os para campos frequentes.
- `int64`/`uint64` chegam ao JS conforme `loader.longs` (ver §2). Tamanhos de arquivo: `int64`.
- `bytes` para binário; nunca base64 dentro de `string`.
- Versão no package (`v1`). Breaking change → `plexus.clinic.v2` em paralelo.
- snake_case no proto; o loader converte para camelCase nas interfaces TS.

**Interface TS espelho** (em `interfaces/`): mesmos campos em camelCase, `oneof` como opcionais.

```ts
export interface RecordUploadStream {
  metadata?: ClinicalMetadata;
  chunk?: FileChunk;
}
```

## 2. Bootstrap híbrido (HTTP + gRPC)

```ts
import { join } from 'node:path';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReflectionService } from '@grpc/reflection';

app.connectMicroservice<MicroserviceOptions>(
  {
    transport: Transport.GRPC,
    options: {
      package: 'plexus.clinic.v1',
      protoPath: join(__dirname, 'proto/clinical.proto'),
      url: config.get<string>('GRPC_URL', '0.0.0.0:50051'),
      loader: { keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true },
      maxReceiveMessageLength: 4 * 1024 * 1024, // por mensagem (chunk), não por arquivo
      onLoadPackageDefinition: (pkg, server) => {
        if (config.get('NODE_ENV') !== 'production') {
          new ReflectionService(pkg).addToServer(server);
        }
      },
    },
  },
  { inheritAppConfig: true }, // aplica pipes/filters/guards globais também ao gRPC
);
await app.startAllMicroservices();
await app.listen(port);
```

- `protoPath` relativo a `__dirname`; o `nest-cli.json` copia `**/*.proto` como asset. Após `npm run build`, confirme que o `.proto` existe no `dist`.
- `keepCase: false` → camelCase (alinha com as interfaces). Mudar isso quebra todas as interfaces.
- `longs: Number` → `int64` vira `number` (ok até 2^53; arquivos de 100MB cabem). Se usar `String`, tipar como `string` na interface. **A escolha precisa bater com a interface.**
- **Reflection só fora de produção** (expõe o schema completo).
- `inheritAppConfig: true` — sem isso, `app.useGlobalPipes(...)` **não** vale para handlers gRPC.
- `url`, porta e limites via `ConfigService`.

## 3. Tipos de handler

| RPC | Decorator | Assinatura |
|-----|-----------|------------|
| Unary | `@GrpcMethod('Service', 'Method')` | `(data: Req, metadata: Metadata) => Promise<Res> \| Res` |
| Client streaming (Observable) | `@GrpcStreamMethod('Service', 'Method')` | `(stream$: Observable<Req>, metadata) => Promise<Res> \| Observable<Res>` |
| Client streaming (stream cru) | `@GrpcStreamCall('Service', 'Method')` | `(call: ServerReadableStream<Req, Res>, callback: sendUnaryData<Res>) => void` |
| Server streaming | `@GrpcMethod` retornando `Observable<Res>` | — |
| Bidi | `@GrpcStreamMethod` retornando `Observable<Res>` | — |

O nome do serviço no decorator deve ser exatamente o `service` do proto (`ClinicalService`). O método é inferido do nome do handler em PascalCase quando omitido. Prefira explicitar.

## 4. Upload em chunks com backpressure (RNF01, RNF02)

`@GrpcStreamMethod` entrega um `Observable` que **não faz backpressure**: se o disco for mais lento que a rede, os chunks acumulam em memória. Para arquivos grandes, use `@GrpcStreamCall` com o stream cru do `grpc-js` e `pause()`/`resume()`.

```ts
@GrpcStreamCall('ClinicalService', 'SaveClinicalRecord')
saveClinicalRecord(
  call: ServerReadableStream<RecordUploadStream, RecordUploadResponse>,
  callback: sendUnaryData<RecordUploadResponse>,
): void {
  this.clinicalService.handleUpload(call).then(
    (res) => callback(null, res),
    (err: unknown) => callback(toGrpcError(err), null),
  );
}
```

```ts
// service — esqueleto do fluxo
async handleUpload(call: ServerReadableStream<RecordUploadStream, unknown>): Promise<RecordUploadResponse> {
  let metadata: ClinicalMetadata | undefined;
  let file: WriteStream | undefined;
  let totalBytes = 0;
  const tmpPath = this.storage.newTempPath();

  try {
    for await (const frame of call) {          // async iterator respeita backpressure
      if (!metadata) {
        if (!frame.metadata) throw invalid('First frame must be metadata');
        metadata = await this.validateMetadata(frame.metadata);
        file = createWriteStream(tmpPath, { flags: 'wx' });
        continue;
      }
      if (!frame.chunk) throw invalid('Metadata sent twice');
      totalBytes += frame.chunk.data.length;
      if (totalBytes > this.maxBytes) throw tooLarge();
      if (!file!.write(frame.chunk.data)) await once(file!, 'drain');
    }
    if (!metadata || !file) throw invalid('Empty stream');
    await finished(file.end());
    return await this.persistRecord(metadata, tmpPath, totalBytes); // transação + move final
  } catch (err) {
    file?.destroy();
    await rm(tmpPath, { force: true });       // nunca deixar arquivo parcial órfão
    throw err;
  }
}
```

Checklist do fluxo:

- [ ] Primeiro frame **obrigatoriamente** `metadata`; validar com `class-validator` antes de abrir o arquivo.
- [ ] Contar bytes acumulados e abortar acima do limite (100MB — RF03), **antes** de escrever.
- [ ] Escrever em path temporário; mover para o path final só após commit no banco (ou registrar `status` em `medical_files`).
- [ ] Em erro ou cancelamento (`call.on('cancelled')` / exceção no iterator): destruir write stream e apagar temporário.
- [ ] Nome do arquivo em disco gerado pelo servidor (UUID + extensão permitida). **Nunca** usar `fileName` do cliente no path.
- [ ] MIME validado por allowlist (e magic bytes quando crítico), não pela extensão.
- [ ] `maxReceiveMessageLength` limita **cada mensagem**; o tamanho total é controle seu.
- [ ] Persistir no banco só metadados + caminho (RNF03).

## 5. Metadata, deadlines e cancelamento

- Auth e correlação chegam em `Metadata` (`metadata.get('authorization')`, `x-request-id`). Ver [security-auth.md](security-auth.md).
- Respeite cancelamento do cliente: interrompa I/O e limpe recursos.
- Chamadas gRPC de saída (`ClientGrpc`) sempre com deadline/timeout (`timeout()` do RxJS ou `deadline` nas call options) e `firstValueFrom`.

## 6. Cliente gRPC (quando este serviço chama outro)

```ts
@Module({
  imports: [ClientsModule.registerAsync([{ name: 'X_PACKAGE', inject: [ConfigService], useFactory: (c: ConfigService) => ({
    transport: Transport.GRPC,
    options: { package: 'x.v1', protoPath: join(__dirname, '../proto/x.proto'), url: c.get('X_GRPC_URL') },
  }) }])],
})
```

```ts
onModuleInit() { this.x = this.client.getService<XServiceClient>('XService'); }
const res = await firstValueFrom(this.x.get({ id }).pipe(timeout(5_000)));
```

## 7. Health check

Expor o protocolo padrão `grpc.health.v1.Health` (ou `@nestjs/terminus` no HTTP) checando dependências reais (PostgreSQL, diretório de storage gravável), não só "estou vivo".

## Fonte

Adaptado de `micro-use-patterns`, `micro-use-health-checks` (kadajett/agent-nestjs-skills), `nestjs-patterns` (affaan-m/ecc) e documentação oficial NestJS/gRPC; seções de streaming e proto são autoria própria para o Plexus.
