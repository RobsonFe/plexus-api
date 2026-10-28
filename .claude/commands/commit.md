---
description: Gera mensagem de commit a partir das alterações staged
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git commit:*)
---
Analise `git diff --staged` e os últimos commits (`git log --oneline -10`) para seguir o estilo do repositório.
Gere uma mensagem de commit em português, no padrão Conventional Commits (ex.: `feat(clinical): ...`),
com um título curto e um corpo listando as mudanças principais. Mostre a mensagem e pergunte antes de commitar.
