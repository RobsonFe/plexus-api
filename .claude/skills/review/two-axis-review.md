# Revisão em dois eixos (Padrões / Spec)

Camada de [SKILL.md](SKILL.md). Revisa o diff entre `HEAD` e um ponto fixo informado pelo usuário em dois eixos:

- **Padrões:** o código segue os padrões documentados deste repositório?
- **Spec:** o código implementa fielmente o requisito de origem?

Os dois eixos rodam como **sub-agentes paralelos**, para que um não polua o contexto do outro. Depois esta camada agrega os achados.

## Processo

### 1. Fixar o ponto de referência

O ponto fixo é o que o usuário informou (SHA, branch, tag, `main`, `HEAD~5`). Se não informou, pergunte (sugestão: `main`).

- Validar: `git rev-parse <ponto-fixo>`.
- Diff: `git diff <ponto-fixo>...HEAD` (três pontos = contra o merge-base).
- Commits: `git log <ponto-fixo>..HEAD --oneline`.
- Ref inválida ou diff vazio falham **aqui**, não dentro dos sub-agentes.

### 2. Identificar a fonte da spec

Nesta ordem:

1. Referência a issue nos commits (`#123`, `Closes #45`) → `gh issue view <n>` se o repositório tiver GitHub remoto.
2. Caminho passado pelo usuário.
3. [docs/CONTEXT.md](../../../docs/CONTEXT.md) — RFs, RNFs e modelagem do Plexus — e qualquer arquivo em `docs/` que corresponda à feature/branch.
4. Nada encontrado → perguntar. Se não existir spec, o eixo Spec é pulado e o relatório registra "nenhuma spec disponível".

### 3. Identificar as fontes de padrões

Fontes deste repositório:

- [`nestjs-grpc`](../nestjs-grpc/SKILL.md) e suas camadas (padrões de implementação).
- Camadas desta skill relevantes ao diff ([nestjs-pass.md](nestjs-pass.md), [grpc-review.md](grpc-review.md), [lgpd.md](lgpd.md)...).
- RNF04 de [docs/CONTEXT.md](../../../docs/CONTEXT.md) (nomes em inglês, sem ORM pesado em queries complexas).
- `.prettierrc`, `.oxlintrc.json`, `tsconfig.json` — mas **pular** o que o ferramental já impõe.
- `CONTRIBUTING.md`/`CODING_STANDARDS.md` se vierem a existir.

Além disso, o eixo Padrões sempre carrega a **baseline de smells** (Fowler, _Refactoring_, cap. 3). Duas regras:

- **O repositório prevalece.** Padrão documentado vence; onde ele endossa algo que a baseline sinalizaria, suprima o smell.
- **Sempre julgamento.** Cada smell é heurística rotulada ("possível Feature Envy"), nunca violação absoluta.

Baseline (*o que é* → *como corrigir*):

- **Nome Misterioso:** nome que não revela o que faz/guarda. → renomear; se nenhum nome honesto surge, o design está confuso.
- **Código Duplicado:** mesma forma de lógica em mais de um hunk/arquivo. → extrair e chamar dos dois lugares.
- **Inveja de Funcionalidade:** método que usa mais dados de outro objeto que os próprios. → mover para junto dos dados.
- **Aglomerado de Dados:** mesmos campos/parâmetros sempre juntos. → agrupar num tipo.
- **Obsessão por Primitivos:** string/number no lugar de conceito de domínio (CPF, status). → tipo próprio pequeno.
- **Switches Repetidos:** mesma cascata `switch`/`if` sobre o mesmo tipo em vários pontos. → polimorfismo ou mapa compartilhado.
- **Cirurgia com Espingarda:** uma mudança lógica força edições espalhadas. → reunir o que muda junto.
- **Mudança Divergente:** um módulo editado por razões não relacionadas. → dividir por razão de mudança.
- **Generalidade Especulativa:** abstração/parâmetro/hook para necessidade que a spec não tem. → remover; inline até haver necessidade real.
- **Cadeia de Mensagens:** `a.b().c().d()` da qual o chamador não deveria depender. → esconder atrás de um método.
- **Intermediário:** classe/função que só delega. → eliminar e chamar o alvo.
- **Herança Recusada:** subclasse que ignora/sobrescreve quase tudo que herda. → composição.

### 4. Disparar os dois sub-agentes em paralelo

Ambos na **mesma mensagem**, em foreground, e agregar o que retornarem.

**Prompt do sub-agente de Padrões** deve conter:

- Comando de diff e lista de commits.
- Lista das fontes de padrões do passo 3 **e a baseline de smells colada na íntegra** (o sub-agente não tem outro acesso a ela).
- Briefing: "Reporte, por arquivo/hunk, (a) cada violação de padrão documentado — cite a fonte (arquivo + regra); (b) cada smell da baseline — nomeie e cite o hunk. Distinga violação absoluta de julgamento: padrão documentado pode ser absoluto; smell da baseline é sempre julgamento, e padrão do repo prevalece sobre a baseline. Pule o que Prettier/oxlint/tsc já impõem. Menos de 400 palavras."

**Prompt do sub-agente de Spec** deve conter:

- Comando de diff e lista de commits.
- Caminho ou conteúdo da spec.
- Briefing: "Reporte: (a) requisitos pedidos ausentes ou parciais; (b) comportamento no diff que não foi pedido (scope creep); (c) requisitos que parecem implementados mas com implementação errada. Cite a linha da spec (ex.: RF03, RNF02) para cada achado. Menos de 400 palavras."

Sem spec → pular o sub-agente de Spec e registrar no relatório.

### 5. Agregar

Apresentar os dois relatórios sob `## Padrões` e `## Spec`, na íntegra ou com limpeza leve. **Não** mesclar nem reordenar entre eixos.

Encerrar com uma linha: total de achados por eixo e o pior problema **dentro de cada eixo**. Não eleger um vencedor entre eixos — é a reordenação que a separação existe para evitar.

## Por que dois eixos

- Segue todos os padrões mas implementa a coisa errada → **Padrões passa, Spec falha.**
- Faz exatamente o que o requisito pediu mas quebra as convenções → **Spec passa, Padrões falha.**

Reportar separado impede que um eixo mascare o outro.

## Fonte

União de `two-axis-review` (skills v11) e `code-review` (Matt Pocock, [github.com/mattpocock/skills](https://github.com/mattpocock/skills)), sem a dependência de `/setup-matt-pocock-skills`; spec padrão apontada para `docs/CONTEXT.md`.
