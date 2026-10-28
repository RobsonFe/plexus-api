# Escrever bons testes

> **Atribuição:** Adaptado de [writing-good-tests.md](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/writing-good-tests.md) (obra/superpowers), via skills v11.

**Carregue quando:** escrever ou alterar testes, adicionar mocks ou helpers de teste.

## Visão geral

Um teste existe para pegar uma quebra específica. Dois princípios:

```
1. Cada teste nomeia a quebra que ele pega
2. Cada teste exercita a coisa real
```

## Princípio 1: Nomear a quebra

Antes do corpo do teste, responda: **qual mudança em produção deve fazer este teste falhar — e isso é bug ou decisão de produto?**

**Derive expectativas de forma independente.** Use literais e fixtures conferidas à mão. Expected calculado pelo código sob teste sempre passa:

```ts
// RUIM — espelho
const expected = maskCpf('12345678900');
expect(maskCpf('12345678900')).toBe(expected);

// BOM — literal
expect(maskCpf('12345678900')).toBe('***.456.789-**');
```

```ts
// RUIM — tamanho calculado pela mesma soma que o service faz
expect(res.totalBytes).toBe(chunks.reduce((n, c) => n + c.data.length, 0));
// BOM
expect(res.totalBytes).toBe(3072); // 3 chunks de 1024
```

**Sem change detectors.** Não teste `expect(MAX_FILE_BYTES).toBe(104_857_600)`; teste que limite + 1 byte é rejeitado.

**Comportamento, não texto.** Não use `grep` em doc/skill como prova; execute e asserte o efeito.

**Seu código, não o framework.** Teste o contrato na sua fronteira (resposta do RPC, linha no banco, arquivo no disco). Não teste que o Nest roteia `@GrpcMethod` para o handler, nem que `class-validator` valida `@IsString` — isso é do framework. Teste que **o seu DTO** rejeita o input inválido do seu domínio.

### Portão (antes do corpo)

```
Nomeie a mudança em produção que faria o teste falhar.
Não consegue nomear → redesenhe em torno de comportamento observável.
"Só mudou o texto da skill" → execute o artefato.
Só decisões intencionais → change detector; teste o comportamento que depende delas.
Expected derivado sem usar a lógica do código sob teste.
```

## Princípio 2: Exercitar a coisa real

**Mock não leva assert.** Assert no componente real; se o teste só confere o mock, apague o assert ou tire o mock.

```ts
// BOM
expect(res).toEqual({ recordId: expect.any(String), totalBytes: 1024, success: true });
expect(await stat(join(storageDir, storedName))).toMatchObject({ size: 1024 });

// RUIM
expect(repo.save).toHaveBeenCalled();
```

**Mock no nível certo.** Mock só o lento/externo (banco, cliente gRPC externo). Mantenha real o que o teste depende: validação `class-validator`, lógica de stream, escrita em disco num diretório temporário.

**Dados espelhados.** Mock com a estrutura completa do real (ex.: entity com `id`, `createdAt`, relações usadas), não só os campos que o teste lê hoje.

**Produção sem método só de teste.** Limpeza em utilitário de teste, não `resetForTests()` no service.

**Prefira componentes reais** quando o setup de mock ficar maior que o teste (ex.: banco de teste no e2e em vez de mockar 6 métodos do `EntityManager`).

### Portão (antes do mock)

```
Liste os efeitos colaterais do método real; mock abaixo do que for externo/lento.
Resposta do mock espelha a estrutura completa.
Método só chamado de teste → util de teste.
Vai assertar no mock? Tire o mock ou remova o assert.
```

Exceção legítima de assert em mock: quando **a chamada é o efeito** (ex.: "não chamou `transaction` quando a validação falhou" — prova a ordem). Mesmo assim, prefira assert no estado (banco/disco vazio).

## Testes junto com a implementação

O ciclo RED-GREEN-REFACTOR define o que é "completo". Teste escrito só para cumprir processo custa manutenção para sempre.

## Checagem de mutação

Antes de encerrar, faça uma mutação mental — cada uma deve derrubar algum teste:

- Limite de bytes `>` trocado por `>=`
- Branch "primeiro frame é metadata" invertido
- `rm(tmp)` removido do `catch`
- Guard de autorização removido
- Retorno com `totalBytes: 0`
- `status.INVALID_ARGUMENT` trocado por `status.INTERNAL`

Mutação que nenhum teste pega = comportamento desprotegido ou teste tautológico.

## Referência rápida

| Situação | Faça |
|----------|------|
| Qualquer teste | Nomeie a quebra (bug, não decisão) |
| Expected | Derive à mão |
| Mock | Fronteira externa; assert no efeito real |
| Erro gRPC | Assert no `code`, não só `rejects.toThrow()` |
| Fim do arquivo | Checagem de mutação |
| E2E | Resposta + banco + disco ([grpc.md](grpc.md)) |

## Sinais de alerta

- Setup e assert no mesmo objeto (igualdade garantida)
- `rejects.toThrow()` sem conferir o tipo/`code` (qualquer erro passa, inclusive `TypeError`)
- Expected montado com helper compartilhado com produção
- Só `resolves.toBeDefined()` / `toBeTruthy()`
- Mock é mais da metade do teste
- Cobertura sem assert de efeito
- `as any` no teste para forçar um estado impossível em produção

Voltar: [SKILL.md](SKILL.md) · Matriz: [scenarios.md](scenarios.md)
