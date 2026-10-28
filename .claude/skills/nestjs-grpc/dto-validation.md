# DTOs, validação e serialização

Camada de [SKILL.md](SKILL.md). Carregar ao criar DTOs, pipes, validação de metadata gRPC, controllers HTTP ou respostas.

Referência: [docs.nestjs.com/techniques/validation](https://docs.nestjs.com/techniques/validation) · [docs.nestjs.com/microservices/pipes](https://docs.nestjs.com/microservices/pipes)

## 1. Interface vs DTO

| Artefato | Papel | Onde |
|----------|-------|------|
| Interface (`interfaces/*.ts`) | **forma** da mensagem proto (tipagem) | espelho 1:1 do `.proto` |
| DTO (`dto/*.dto.ts`) | **regras** de validação (`class-validator`) do input | só onde há input externo |

A interface tipa o que chega; o DTO valida. Não duplique a interface inteira em DTO se nada precisa ser validado.

```ts
export class ClinicalMetadataDto implements ClinicalMetadata {
  @IsString() @Length(3, 255) patientFullName: string;
  @Matches(/^\d{11}$/, { message: 'patientCpf deve conter 11 dígitos' }) patientCpf: string;
  @Matches(/^\+?\d{10,13}$/) patientPhone: string;
  @IsString() @MaxLength(20_000) doctorNotes: string;
  @IsString() @Length(1, 255) fileName: string;
  @IsIn(['application/pdf', 'image/png', 'image/jpeg']) fileMimeType: string;
}
```

- Normalizar antes de validar quando fizer sentido (`@Transform(({ value }) => value.replace(/\D/g, ''))` para CPF/telefone).
- CPF: validar formato **e** dígitos verificadores (validator próprio `@IsCpf()` em `validation/` — só criar quando for usado).
- Strings sempre com limite máximo (`MaxLength`/`Length`).
- Mensagens de validação em **PT-BR** (`{ message: '...' }`), citando o campo e a regra.
- Prefira decorators do `class-validator` a funções de validação próprias (KISS).
- Objetos aninhados: `@ValidateNested()` + `@Type(() => X)`; arrays com `@ArrayMaxSize`.

## 2. ValidationPipe em contexto gRPC

O `ValidationPipe` padrão lança `BadRequestException` (HTTP). Em handler gRPC isso vira erro genérico. Use `exceptionFactory` que gera `RpcException`:

```ts
export const grpcValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new RpcException({
      code: status.INVALID_ARGUMENT,
      message: errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; '),
    }),
});

@Controller()
@UsePipes(grpcValidationPipe)
export class ClinicalController {}
```

- Pipes globais (`app.useGlobalPipes`) só valem para o gRPC com `connectMicroservice(..., { inheritAppConfig: true })`.
- **Pipes não validam o conteúdo de stream.** Em `@GrpcStreamMethod`/`@GrpcStreamCall`, valide o frame de metadata manualmente:

```ts
private async validateMetadata(raw: ClinicalMetadata): Promise<ClinicalMetadataDto> {
  const dto = plainToInstance(ClinicalMetadataDto, raw);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const message = errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; ');
    throw new RpcException({ code: status.INVALID_ARGUMENT, message });
  }
  return dto;
}
```

Se o mesmo formato de mensagem for usado aqui e no `exceptionFactory` do pipe (2 usos), aí sim extraia uma função em `common/`.

- Mensagens de erro de validação não podem ecoar o valor recebido (ex.: CPF) — só o nome do campo e a regra.

## 3. Respostas

- Nunca devolver entity TypeORM direto (vaza colunas internas, relações, `disk_path`).
- gRPC: o **Mapper** monta a mensagem de resposta explicitamente (`ClinicalRecordMapper.toUploadResponse(...)`) — ver [typeorm-database.md](typeorm-database.md#5-mapper). Get → `result`, List → `results` + `meta`.
- HTTP: response DTO com `@Exclude()`/`@Expose()` + `ClassSerializerInterceptor`, ou mapeamento explícito.

## 4. Controllers HTTP (quando existirem)

O app é híbrido (`api/v1` + Swagger em `/doc`). Para rotas REST:

- Controller fino: `@Body() dto`, `@Param('id', ParseUUIDPipe) id`, chama service, retorna DTO.
- Status explícito (`@HttpCode(HttpStatus.CREATED)`), exceptions HTTP tipadas (`NotFoundException`, `ConflictException`).
- Swagger: `@ApiTags`, `@ApiOperation`, `@ApiResponse` e `@ApiProperty` nos DTOs.
- Versionamento via prefixo (`api/v1`) já configurado; breaking change → `v2`.
- Não expor upload de 100MB via JSON/base64 em HTTP — o caminho é o gRPC streaming.

## 5. Interceptors

Para preocupações transversais (logging de duração, correlação, transformação de resposta). Sem lógica de negócio. Em gRPC, use `context.switchToRpc()` (`getData()`, `getContext()` → `Metadata`).

## Fonte

Adaptado de `api-use-dto-serialization`, `api-use-pipes`, `api-use-interceptors`, `api-versioning`, `security-validate-all-input` (kadajett/agent-nestjs-skills) e `references/dtos-validation.md` + `controllers-routing.md` (jeffallan/claude-skills).
