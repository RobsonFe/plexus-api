# Test-Driven Development (TDD)

> **Atribuição:** Adaptado de [obra/superpowers `test-driven-development`](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md), via skills v11.

## Visão geral

Escreva o teste primeiro. Veja ele falhar. Escreva o código mínimo para passar.

**Princípio central:** se você não viu o teste falhar, não sabe se ele testa a coisa certa.

**Violar a letra das regras é violar o espírito das regras.**

## Quando usar

**Sempre:**

- Features novas
- Correção de bugs
- Refatoração
- Mudanças de comportamento

**Exceções (combinar com o humano):**

- Protótipos descartáveis
- Código gerado (ex.: tipos gerados a partir do `.proto`)
- Arquivos de configuração

Pensou em "pular TDD só desta vez"? Pare. É racionalização.

## Lei de ferro

```
NENHUM CÓDIGO DE PRODUÇÃO SEM TESTE FALHANDO ANTES
```

Escreveu código antes do teste? Apague. Comece de novo.

**Sem exceções:**

- Não guardar como "referência"
- Não "adaptar" enquanto escreve testes
- Não olhar o código antigo
- Apagar é apagar

Implemente de novo a partir dos testes.

> **Plexus:** se o usuário já aprovou a implementação existente, o agente **não apaga** produção sozinho. Ainda assim: nomeie a quebra e, quando o bug for reprodutível, observe RED antes do GREEN. Teste que passa na primeira execução sem RED observado **não conta** como regressão ([SKILL.md](SKILL.md)).

## Red-Green-Refactor

### RED — teste falhando

Um teste mínimo que mostra o comportamento desejado.

```ts
// BOM
it('rejects a chunk sent before metadata', async () => {
  const error = await service.saveClinicalRecord(fakeUploadCall([chunk(10)])).catch((e: unknown) => e);

  expect((error as RpcException).getError()).toMatchObject({ code: status.INVALID_ARGUMENT });
});
```

```ts
// RUIM — nome vago, testa mock
it('works', async () => {
  const save = jest.fn().mockResolvedValue({ id: '1' });
  await service.saveClinicalRecord(call);
  expect(save).toHaveBeenCalled();
});
```

**Requisitos:** um comportamento; nome claro; código real (mock só na fronteira).

### Verificar RED — obrigatório

```powershell
npm test -- src/modules/clinical/test/clinical.service.spec.ts -t "rejects a chunk sent before metadata"
```

Confirme:

- Falha (não erro de import, de compilação do `ts-jest` ou de DI não intencional)
- Mensagem de falha esperada
- Falha porque a feature falta (não typo no teste)

**Passou de primeira?** Você está testando comportamento que já existe — corrija o teste.

### GREEN — código mínimo

Só o necessário para passar. Sem features extras.

### Verificar GREEN — obrigatório

- Teste novo passa
- **Suíte do escopo** passa (`npm test -- src/modules/clinical`), não só o teste isolado
- Qualquer falha na suíte entra no relatório pelo nome

### REFACTOR

Só depois do verde: remover duplicação, melhorar nomes. Testes continuam verdes.

## Bons testes

| Qualidade | Bom | Ruim |
|-----------|-----|------|
| Mínimo | Uma coisa; "and" no nome? Divida. | `it('validates cpf and mime and size')` |
| Claro | Nome descreve comportamento | `it('test 1')` |
| Intenção | Mostra a API desejada | Esconde o que o código deve fazer |

Nomes de teste em inglês, como as funções (RNF04). Ao escrever ou mudar testes, leia [good-tests.md](good-tests.md).

## Racionalizações comuns

| Desculpa | Realidade |
|----------|-----------|
| "Muito simples para testar" | Código simples quebra. O teste leva segundos. |
| "Testo depois" | Teste escrito depois passa na hora — não prova nada. |
| "Já testei no grpcurl" | Teste manual não se repete igual; automatizado sim. |
| "Stream é difícil de testar" | `Readable.from([...])` resolve em uma linha ([grpc.md](grpc.md)). |
| "Apagar X horas é desperdício" | Desperdício é código sem teste confiável. |

## Bandeiras vermelhas — recomeçar com TDD

- Código antes do teste
- Teste depois da implementação
- Teste passa imediatamente sem RED observado
- Não sabe explicar por que falhou
- "Só desta vez"

## Bug fix

**Bug:** upload aceita arquivo acima de 100MB.

**RED**

```ts
it('rejects a file one byte above the limit', async () => {
  const error = await service.saveClinicalRecord(fakeUploadCall([{ metadata: validMetadata }, chunk(LIMIT + 1)])).catch((e: unknown) => e);

  expect((error as RpcException).getError()).toMatchObject({ code: status.RESOURCE_EXHAUSTED });
  expect(await readdir(storageDir)).toEqual([]);
});
```

**Verificar RED** — falha com mensagem esperada (o upload passava).

**GREEN** — checagem mínima do total antes de escrever.

**Verificar GREEN** — `npm test` verde no escopo.

Nunca corrija bug sem teste que o reproduza.

## Checklist antes de concluir

- [ ] Cada comportamento novo tem teste
- [ ] Vi cada teste falhar antes de implementar (quando reprodutível)
- [ ] Falhou pelo motivo certo (feature ausente)
- [ ] Código mínimo para passar
- [ ] Suíte relevante verde
- [ ] Mocks só na fronteira
- [ ] Erros e bordas cobertos ([scenarios.md](scenarios.md))

Voltar: [SKILL.md](SKILL.md).
