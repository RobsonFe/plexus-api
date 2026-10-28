# Security and Hardening (revisão)

Camada de [SKILL.md](SKILL.md). Trate todo input externo como hostil, todo segredo como sagrado e toda autorização como obrigatória. Segurança é restrição em toda linha que toca dado de paciente, autenticação ou sistema externo.

Implementação de referência: [nestjs-grpc/security-auth.md](../nestjs-grpc/security-auth.md).

## Quando usar

- Diff que aceita input externo (metadata/frames gRPC, DTO HTTP, query params).
- Autenticação ou autorização.
- Upload de arquivo, escrita em disco, paths.
- Integração externa, dependência nova, configuração (CORS, Swagger, reflection, TLS).

## Fronteiras em três níveis

### Sempre

- Validar input na fronteira (DTO + `ValidationPipe`/validação manual do frame de metadata).
- Parametrizar queries.
- Limitar tamanhos (mensagem, total do arquivo, strings).
- TLS em toda comunicação externa (gRPC e HTTP).
- Erro ao cliente sem detalhe interno.
- `npm audit` antes de release.

### Perguntar antes

- Novo fluxo ou mudança de auth.
- Nova categoria de dado sensível.
- Nova integração externa, mudança de CORS, limites de upload, rate limit.
- Exposição de reflection/Swagger fora de dev.

### Nunca

- Commitar segredo; logar dado sensível (CPF, notas, token).
- Confiar em validação do cliente (Next.js) como fronteira.
- Usar input do cliente em path de arquivo, SQL, shell ou `eval`.
- Expor stack trace, erro do `pg` ou path interno.

## OWASP aplicado ao Plexus

### 1. Injection (SQL / comando / path)

```ts
// ❌
this.dataSource.query(`SELECT * FROM patients WHERE document_cpf = '${cpf}'`);
qb.orderBy(req.sortBy); // coluna arbitrária do cliente
// ✅
this.dataSource.query('SELECT id FROM patients WHERE document_cpf = $1', [cpf]);
qb.orderBy(SORTABLE[req.sortBy] ?? 'p.created_at');
```

### 2. Path traversal / upload

```ts
// ❌ cliente controla o destino
createWriteStream(join(storageDir, metadata.fileName)); // "../../etc/x"
// ✅ servidor gera o nome
const finalPath = join(storageDir, `${randomUUID()}${EXT_BY_MIME[mime]}`);
```

- [ ] `fileName` do cliente só vai para `original_name`.
- [ ] MIME por allowlist (PDF, PNG, JPEG — RF03); magic bytes conferidos quando crítico; extensão derivada do MIME validado.
- [ ] Limite total (100MB) imposto no servidor.
- [ ] Storage fora de diretório servido estaticamente; permissões restritas.

### 3. Autenticação quebrada

- [ ] Handler gRPC protegido lê credencial da metadata e valida (guard).
- [ ] JWT: segredo do `ConfigService`, expiração, algoritmo fixo; sem `ignoreExpiration`.
- [ ] Falha → `UNAUTHENTICATED`, sem dizer o motivo exato.
- [ ] Rate limit em autenticação.

### 4. Controle de acesso quebrado (IDOR)

- [ ] Busca por `recordId`/`patientId` filtra pelo vínculo do usuário.
- [ ] Fora do escopo → `NOT_FOUND`.
- [ ] Autorização no servidor; frontend só esconde UI.

### 5. Configuração insegura

Pontos conhecidos neste repo (sinalizar quando o diff tocar ou antes de produção):

- [ ] `synchronize: true` no TypeORM.
- [ ] CORS `origin: '*'` em `main.ts`.
- [ ] Swagger `/doc` público.
- [ ] Credenciais default do banco no `ConfigService.get(..., default)`.
- [ ] `appKey`/`appSecret` placeholder no `ObserveModule` (deve vir do config).
- [ ] Reflection gRPC habilitado sem condição de ambiente.
- [ ] `helmet` ausente no HTTP.

### 6. Exposição de dados sensíveis

- [ ] Resposta mínima; entity nunca devolvida direto.
- [ ] Logs sem PII ([lgpd.md](lgpd.md)).
- [ ] Mensagens de validação não ecoam valores.

## Triagem de `npm audit`

```
vulnerabilidade reportada
├── critical/high
│   ├── alcançável em runtime? SIM → corrigir agora (update/patch/substituir)
│   │                          NÃO (dev-only) → corrigir logo, não bloqueia
│   └── sem fix? → workaround, substituir ou registrar com data de revisão
├── moderate → próximo ciclo se alcançável; backlog se dev-only
└── low → atualização regular
```

Ao adiar: documentar motivo e data de revisão.

## Rate limiting

- HTTP: `@nestjs/throttler` (limites menores em auth).
- gRPC: guard/interceptor próprio ou proxy; limitar uploads simultâneos por usuário.

## Segredos

```
.env           → não versionado (segredos reais)
.env.local     → não versionado
.env.example   → versionado, só placeholders
```

- [ ] `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`. Arquivo de env já versionado (`git ls-files '.env*'`) → remover do índice (`git rm --cached`) e rotacionar o que for segredo real.
- [ ] `git diff --cached | grep -iE "password|secret|api_key|token|appSecret"` limpo.

## Racionalizações comuns

| Racionalização | Realidade |
|---|---|
| "É projeto de estudo" | Dados de saúde fictícios hoje viram reais amanhã; o hábito fica. |
| "Depois coloco auth" | Retrofit de auth em handlers prontos é mais caro e esquece caminhos. |
| "O frontend já valida" | gRPC é chamável por qualquer cliente com o `.proto` (reflection o entrega). |
| "O framework cuida" | Nest dá as ferramentas; `inheritAppConfig`, pipes em stream e filters em `@GrpcStreamCall` precisam ser configurados. |

## Red flags

- Input do cliente em SQL, path, shell.
- Handler gRPC sem guard.
- CORS `*`, reflection/Swagger em produção.
- Segredo em código ou histórico.
- Stack/erro de driver na resposta.
- Dependência com vulnerabilidade crítica alcançável.

## Verificação

- [ ] `npm audit` sem critical/high alcançável.
- [ ] Nenhum segredo em código/histórico.
- [ ] Input validado na fronteira; limites aplicados.
- [ ] Auth + autorização por recurso em todo handler protegido.
- [ ] Erros sem detalhe interno.

## Fonte

Adaptado de `security-hardening` (skills v11) e `security-*` (kadajett/agent-nestjs-skills).
