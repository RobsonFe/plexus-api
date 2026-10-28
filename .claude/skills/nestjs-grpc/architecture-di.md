# Arquitetura em camadas, módulos e DI

Camada de [SKILL.md](SKILL.md). Carregar ao criar ou alterar `*.module.ts`, estrutura de pastas, camadas, providers, imports/exports entre módulos, escopo ou tokens. Regras obrigatórias: [plexus-rules.md §3–5](../../rules/plexus-rules.md#3-arquitetura-modular-camadas-versão-híbrida).

Referência: [docs.nestjs.com/modules](https://docs.nestjs.com/modules) · [docs.nestjs.com/fundamentals/custom-providers](https://docs.nestjs.com/fundamentals/custom-providers)

## 1. Estrutura por módulo

Organize por **domínio**, e dentro do domínio por **camada**.

```text
src/
├── main.ts
├── app.module.ts                  # só importa módulos de feature + infra (Config, TypeORM)
├── common/                        # filters, guards, interceptors, pipes usados por 2+ módulos
├── proto/                         # contratos .proto
└── modules/
    └── clinical/
        ├── clinical.module.ts
        ├── controller/clinical.controller.ts       # @Grpc* (fino)
        ├── service/clinical.service.ts             # regra de negócio
        ├── repository/clinical-record.repository.ts# único que conhece o TypeORM
        ├── mapper/clinical-record.mapper.ts        # entity → mensagem proto
        ├── dto/clinical-metadata.dto.ts
        ├── entities/                               # *.entity.ts (decorators TypeORM)
        ├── interfaces/clinical.interfaces.ts       # espelho do proto
        └── test/                                   # *.spec.ts do módulo
```

`validation/`, `constants/` e `contracts/` só são criadas quando têm conteúdo real (KISS). ❌ pasta vazia "para padronizar".

❌ `src/controllers/`, `src/services/` globais. ❌ `AppModule` registrando controllers/providers de várias features.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity, ClinicalRecordEntity, MedicalFileEntity])],
  controllers: [ClinicalController],
  providers: [ClinicalService, ClinicalRecordRepository],
})
export class ClinicalModule {}
```

## 2. Camadas

```
Controller ──► Service ──► Repository ──► TypeORM
                  │
                  └──► Mapper (entity → mensagem)
```

| Camada | Injeta | Nunca injeta/importa |
|--------|--------|----------------------|
| Controller | Service | Repository, TypeORM |
| Service | Repository, ConfigService, Logger | `typeorm`, `@InjectRepository`, `DataSource` |
| Repository | `@InjectRepository(...)`, `DataSource` | Service, `RpcException` de regra de negócio |
| Mapper | nada (métodos estáticos) | qualquer provider |

```ts
// service — depende do repository do módulo, não do ORM
@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);

  constructor(
    private readonly records: ClinicalRecordRepository,
    private readonly config: ConfigService,
  ) {}
}
```

```ts
// repository — único ponto com TypeORM
@Injectable()
export class ClinicalRecordRepository {
  constructor(
    @InjectRepository(ClinicalRecordEntity) private readonly records: Repository<ClinicalRecordEntity>,
    private readonly dataSource: DataSource,
  ) {}
}
```

- O Repository expõe **métodos de domínio** (`saveRecordWithFile`, `findForPatient`), não um CRUD genérico que repassa `find`/`save`.
- Um repository por agregado (ex.: `ClinicalRecordRepository` cuida de prontuário + arquivo + upsert de paciente no mesmo fluxo). Não crie um repository por tabela sem necessidade.
- Mapper: classe com métodos estáticos ou funções exportadas, sem DI. Sem mapper genérico/reflexivo.

## 3. Compartilhamento entre módulos

- Um provider pertence a **um** módulo. Outros o recebem via `imports` + `exports`, nunca registrando a mesma classe de novo (instâncias duplicadas).
- Exporte só o que outro módulo realmente consome.
- `@Global()` só para infra transversal (config, logger). `ConfigModule` já é `isGlobal: true`.

## 4. Dependências circulares

- Ciclo entre módulos é defeito de design: extraia a parte comum para um terceiro módulo ou use evento.
- `forwardRef()` apenas como último recurso, com comentário explicando por quê.

## 5. Responsabilidade única

- Um service por responsabilidade de domínio. Sinais de god service: muitos repositories injetados, métodos sem relação entre si, métodos > 50 linhas.
- Separar quando houver motivo real: ex. I/O de disco (`MedicalFileStorage`) vira provider próprio **se** for usado por 2+ services ou tiver implementações alternativas. Até lá, fica no service.
- Não crie um provider por função.

## 6. Injeção de dependência

- **Sempre construtor**; ❌ propriedade com `@Inject()`, ❌ `moduleRef.get()` como service locator, ❌ `new OutroService()`.
- `new Logger(Classe.name)` é a exceção aceita de `new`.

### Tokens e `contracts/`

Interfaces TS não existem em runtime. Token + interface em `contracts/` **só** quando houver duas implementações reais (ex.: storage local vs S3):

```ts
export const FILE_STORAGE = Symbol('FILE_STORAGE');
export interface FileStorage { commit(tmpPath: string, finalName: string): Promise<string>; }

providers: [{ provide: FILE_STORAGE, useClass: LocalDiskStorage }]
constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}
```

Com uma implementação, injete a classe diretamente — ela já é mockável no `TestingModule`.

- **ISP:** interfaces pequenas por capacidade. **LSP:** implementações alternativas honram o mesmo contrato (mesmos erros e garantias).

## 7. Escopos de provider

| Escopo | Uso | Custo |
|--------|-----|-------|
| `DEFAULT` (singleton) | quase tudo | nenhum |
| `REQUEST` | estado por requisição (raro) | instância por request e propaga para quem o injeta |
| `TRANSIENT` | instância por consumidor | baixo |

- Singleton **não** guarda estado de requisição em campo (`this.currentUser = ...`).
- Em gRPC, estado por chamada vai no argumento/metadata, não em provider `REQUEST`.

## 8. Eventos

`@nestjs/event-emitter` para efeitos colaterais não críticos ("registro criado → auditoria"), emitidos **após** o commit. Só introduza quando houver consumidor real.

## 9. Lifecycle hooks

- `onModuleInit`/`onApplicationBootstrap` aguardam/retornam a Promise; nada de fire-and-forget no boot.
- `app.enableShutdownHooks()` + `onApplicationShutdown` para fechar recursos ([errors-observability.md](errors-observability.md)).

## Fonte

Adaptado de `arch-*`, `di-*`, `perf-async-hooks` (kadajett/agent-nestjs-skills), `nestjs-patterns` (affaan-m/ecc), `references/services-di.md` (jeffallan/claude-skills) e das regras de camadas do Plexus.
