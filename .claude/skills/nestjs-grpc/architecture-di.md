# Arquitetura de módulos e DI

Camada de [SKILL.md](SKILL.md). Carregar ao criar ou alterar `*.module.ts`, providers, imports/exports entre módulos, escopo ou tokens.

Referência: [docs.nestjs.com/modules](https://docs.nestjs.com/modules) · [docs.nestjs.com/fundamentals/custom-providers](https://docs.nestjs.com/fundamentals/custom-providers)

## 1. Módulos por feature

Organize por **domínio**, não por camada técnica.

```text
src/
├── main.ts
├── app.module.ts            # só importa módulos de feature + infra (Config, TypeORM)
├── common/                  # filters, guards, interceptors, pipes compartilhados
├── proto/                   # contratos .proto
└── modules/
    └── clinical/
        ├── clinical.module.ts
        ├── clinical.controller.ts      # gRPC (fino)
        ├── clinical.service.ts
        ├── entities/
        ├── interfaces/                 # espelho do proto
        └── dto/
```

❌ `src/controllers/`, `src/services/`, `src/entities/` globais.
❌ `AppModule` registrando controllers/providers de várias features.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity, ClinicalRecordEntity, MedicalFileEntity])],
  controllers: [ClinicalController],
  providers: [ClinicalService],
})
export class ClinicalModule {}
```

## 2. Compartilhamento entre módulos

- Um provider pertence a **um** módulo. Outros módulos o recebem via `imports` + `exports`, nunca registrando a mesma classe de novo em `providers` (gera instâncias duplicadas e estado inconsistente).
- Exporte só o que outro módulo realmente consome (sem over-exporting).
- `@Global()` só para infra verdadeiramente transversal (config, logger). `ConfigModule` já é `isGlobal: true` aqui.

## 3. Dependências circulares

- Ciclo entre módulos (`A imports B imports A`) é defeito de design. Corrija com:
  1. extrair a parte comum para um terceiro módulo; ou
  2. evento (`@nestjs/event-emitter`) quando é notificação "aconteceu X".
- `forwardRef()` apenas como último recurso e com comentário explicando por quê.

## 4. Responsabilidade única

- Um service por responsabilidade de domínio. Sinais de "god service": >~300 linhas, muitos repositórios injetados, métodos sem relação entre si.
- Para o upload clínico, separar quando crescer: orquestração (`ClinicalService`) ↔ I/O de disco (`MedicalFileStorage`) — o storage tem I/O externo, então justifica provider próprio (ver hierarquia em [SKILL.md](SKILL.md#código-enxuto-onde-implementar)).
- Não crie um provider por função.

## 5. Injeção de dependência

**Sempre construtor:**

```ts
@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);

  constructor(
    @InjectRepository(PatientEntity) private readonly patients: Repository<PatientEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}
}
```

- ❌ Propriedade com `@Inject()` escondendo dependência; ❌ `moduleRef.get()` como service locator dentro de lógica de negócio; ❌ `new OutroService()`.
- `Logger` com contexto (`new Logger(Classe.name)`) é a exceção aceita de `new`.

### Tokens para abstrações

Interfaces TS não existem em runtime, então não servem como token. Quando houver **duas implementações reais** (ex.: storage em disco local vs S3), use token:

```ts
export const FILE_STORAGE = Symbol('FILE_STORAGE');
export interface FileStorage { createTemp(): Promise<WriteTarget>; commit(tmp: string, finalName: string): Promise<string>; }

providers: [{ provide: FILE_STORAGE, useClass: LocalDiskStorage }]
constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}
```

Com uma única implementação e nenhum plano concreto de segunda, injete a classe diretamente (evitar generalidade especulativa).

- **ISP:** interfaces pequenas por capacidade, não um "IService" gordo.
- **LSP:** implementações alternativas honram o mesmo contrato (mesmos erros, mesmas garantias); não lance `NotImplemented` em métodos herdados.

## 6. Escopos de provider

| Escopo | Uso | Custo |
|--------|-----|-------|
| `DEFAULT` (singleton) | quase tudo | nenhum |
| `REQUEST` | estado por requisição (raro) | instância por request **e propaga para quem o injeta** |
| `TRANSIENT` | instância por consumidor | baixo |

- Singleton **não** guarda estado de requisição em campo (`this.currentUser = ...`) — vaza entre chamadas concorrentes.
- Em gRPC, estado por chamada vai no argumento/metadata, não em provider `REQUEST`.

## 7. Eventos para desacoplar

Use `EventEmitter2` (`@nestjs/event-emitter`) para efeitos colaterais não críticos ("registro criado → auditoria/notificação"). Emitir **após** o commit da transação. O handler trata o próprio erro (não propaga ao emissor).

## 8. Lifecycle hooks

- `onModuleInit`/`onApplicationBootstrap` devem `await`/retornar a Promise; nada de fire-and-forget no boot.
- `app.enableShutdownHooks()` + `onApplicationShutdown` para fechar recursos (ver [errors-observability.md](errors-observability.md)).

## Fonte

Adaptado de `arch-*`, `di-*`, `perf-async-hooks` (kadajett/agent-nestjs-skills), `nestjs-patterns` (affaan-m/ecc) e `references/services-di.md` (jeffallan/claude-skills).
