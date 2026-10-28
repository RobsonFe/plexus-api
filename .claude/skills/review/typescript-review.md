# Revisão de TypeScript

Camada de [SKILL.md](SKILL.md) para qualquer `.ts` do diff. Formatação é do Prettier (`singleQuote`, `trailingComma: all`) e lint do oxlint: **não** reportar o que eles já cobrem.

Config relevante (`tsconfig.json`): `strict: true`, `strictPropertyInitialization: false` (necessário para entities/DTOs com decorators), `module: nodenext`, `isolatedModules: true`. As regras exigem também `noImplicitOverride` ([plexus-rules.md §1.4](../../rules/plexus-rules.md#14-typescript)) — hoje ainda não ativo no `tsconfig.json`; `override` ausente em método sobrescrito é Sugestão até ativar.

## Checklist

### Type safety
- [ ] Sem `any` novo (parâmetro, retorno, `catch (e: any)`). Use `unknown` + narrowing.
- [ ] `as` só após verificação em runtime; `as unknown as T` → explicar ou remover.
- [ ] Non-null `!` fora de entity/DTO justificado (o valor realmente não pode ser nulo?).
- [ ] Sem `@ts-ignore`; `@ts-expect-error` só com comentário do motivo.
- [ ] Retorno explícito em métodos públicos de service/controller.
- [ ] Interfaces espelho do proto sem campos "a mais" que o proto não tem.
- [ ] Union/enum para status em vez de `string` livre.
- [ ] `isolatedModules`: reexport de tipo com `export type`.

### Async
- [ ] Toda Promise com `await`, `return` ou `.catch` (sem floating promise).
- [ ] `void promise` só quando fire-and-forget é intencional **e** o erro é tratado dentro.
- [ ] Sem `async` em callback de `forEach` (não aguarda) → `for...of` ou `Promise.all`.
- [ ] `Promise.all` com volume ilimitado → limitar concorrência.
- [ ] Callbacks de stream (`on('data')`) não fazem `await` sem controlar backpressure; preferir `for await`/`pipeline`.
- [ ] Sem I/O síncrono (`readFileSync`, `writeFileSync`) em caminho de requisição.
- [ ] RxJS: `firstValueFrom` com `timeout`; sem `subscribe` sem tratamento de erro.

### Erros
- [ ] `catch (err: unknown)` com narrowing (`err instanceof Error`).
- [ ] Sem `catch {}` vazio nem `catch (e) { throw e }` inútil.
- [ ] Erro relançado preserva causa (`new DomainError('...', { cause: err })`).
- [ ] Erro de domínio como classe própria quando há tratamento específico.
- [ ] Mensagem sem dado sensível.

### Documentação e tamanho
- [ ] JSDoc em método público de service/repository/mapper e função exportada: descrição, `@param`, `@returns`, `@throws`.
- [ ] Método > 50 linhas → Obrigatório (extrair **um** método privado com nome de domínio, não vários helpers genéricos).
- [ ] Aninhamento > 2 níveis → guard clauses.
- [ ] Comentário inline só nas exceções (decisão não óbvia, workaround, limitação externa).
- [ ] Mensagem ao cliente em PT-BR; identificadores em inglês.

### Erros comuns
- [ ] `console.log` → `Logger`.
- [ ] Comparação com `==` (usar `===`).
- [ ] Mutação de parâmetro/objeto recebido.
- [ ] `Date` sem timezone explícito em regra de negócio.
- [ ] Número grande vindo de `bigint`/`int64` tratado como `number` sem cuidado.
- [ ] Import relativo profundo (`../../../`) onde o projeto tem padrão diferente.
- [ ] `Buffer` concatenado em loop para dados grandes.

## Padrões válidos (NÃO sinalizar)

- Propriedades de entity/DTO sem inicializador (permitido por `strictPropertyInitialization: false`).
- `public` explícito nas entities (convenção atual do módulo `clinical`).
- `unknown` em `catch` seguido de narrowing.
- `as` após type guard ou validação `class-validator`.
- `void bootstrap()` no `main.ts`.
- Cast de `loadPackageDefinition` em teste (lib sem tipos gerados).

## Regras sensíveis ao contexto

| Problema | Sinalizar SOMENTE SE |
|----------|----------------------|
| `catch` genérico | há tipo de erro específico disponível e tratamento diferente faz sentido |
| Variável não usada | não tem prefixo `_` e o oxlint não pegou |
| Retorno implícito | método público de service/controller ou função exportada |

## Portões (fluxo de reporte)

Completar **em ordem**:

1. **Escopo:** listar todo `.ts` inspecionado.
2. **Falso positivo:** cada achado conferido contra "Padrões válidos" e "Regras sensíveis ao contexto".
3. **Evidência:** cada achado com `[ARQUIVO:LINHA]`.
4. **Protocolo:** seguir o template e o workflow de [SKILL.md](SKILL.md).
5. **Entrega:** saída no formato exigido, sem lista crua de issues.

## Perguntas de revisão

1. Há `any`/`as` escondendo erro de tipo real?
2. Toda Promise é aguardada ou tratada?
3. Streams respeitam backpressure?
4. Erros preservam causa e não vazam dado sensível?
5. Tipos de `int64`/`bigint` estão coerentes ponta a ponta?

## Fonte

Adaptado de `python-review` + `python-type-safety`, `python-async`, `python-error-handling`, `python-common-mistakes` (skills v11) para TypeScript/Node.
