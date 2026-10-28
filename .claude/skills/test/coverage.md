# Cobertura com Jest

O objetivo da cobertura é **encontrar comportamento sem teste**, não atingir 100% de linhas com asserts tautológicos.

## Comandos (Plexus)

```powershell
# suíte inteira (config em jest.config.ts → ./coverage)
npm run test:cov

# só um módulo, com linhas faltando no terminal
npm run test:cov -- src/modules/clinical --collectCoverageFrom="src/modules/clinical/**/*.ts" --coverageReporters=text

# relatório navegável (linhas não cobertas em vermelho)
npm run test:cov -- --collectCoverageFrom="src/modules/clinical/**/*.ts" --coverageReporters=html
# abrir coverage/index.html
```

`--coverageReporters=text` mostra `Uncovered Line #s` por arquivo; arquivo com 100% não precisa abrir.

Excluir do foco (não exigem teste próprio): `*.module.ts`, `main.ts`, `interfaces/*.ts`, entities sem lógica, DTOs só com decorators (a validação deles é coberta pelos testes do service/handler).

## Regras do Plexus (prevalecem sobre "100% de linhas")

- Linha não coberta é **candidata** a teste de **comportamento**, não obrigação de executar a linha.
- Meta: teste que **falharia** se o bug voltasse (ver [good-tests.md](good-tests.md) e [scenarios.md](scenarios.md)), não percentual.
- Prioridade de cobertura: ramos de erro do stream, limpeza de arquivo temporário, validação de metadata, mapeamento de status gRPC, autorização.
- Não escrever teste só para cobrir getter trivial, construtor ou branch impossível sem ganho de regressão.
- Depois de alterar código, rode a **suíte do escopo**, não só o arquivo editado.
- Não adicionar `coverageThreshold` global sem combinar com o time.

## Fluxo

1. Rodar `test:cov` restrito aos arquivos alterados.
2. Nos arquivos do diff, identificar linhas não cobertas ligadas a erro, validação ou domínio.
3. Para cada uma relevante, escrever teste que nomeia a quebra (sem espelhar a implementação no expected).
4. Repetir até os ramos declarados na matriz de [scenarios.md](scenarios.md) estarem cobertos — não até 100% cego.

## Cuidados

- `coverage/` está no `.gitignore`; não versionar relatório.
- Cobertura de e2e (`test:e2e`) não entra no `test:cov` por padrão; não somar sem configurar.

Voltar ao orquestrador: [SKILL.md](SKILL.md).
