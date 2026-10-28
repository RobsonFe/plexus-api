# Segurança e autenticação (implementação)

Camada de [SKILL.md](SKILL.md). Carregar ao implementar auth, guards, rate limit, CORS ou qualquer coisa que receba input externo. A **revisão** de segurança é em [review/security-hardening.md](../review/security-hardening.md).

Referência: [docs.nestjs.com/microservices/guards](https://docs.nestjs.com/microservices/guards) · [docs.nestjs.com/security/authentication](https://docs.nestjs.com/security/authentication)

## 1. Autenticação em gRPC

Credenciais chegam na **metadata** da chamada, não em headers HTTP.

```ts
@Injectable()
export class GrpcAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const metadata = ctx.switchToRpc().getContext<Metadata>();
    const [raw] = metadata.get('authorization');
    const token = typeof raw === 'string' ? raw.replace(/^Bearer /, '') : undefined;
    if (!token) throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Missing credentials' });
    try {
      metadata.set('x-user-id', (await this.jwt.verifyAsync<{ sub: string }>(token)).sub);
      return true;
    } catch {
      throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Invalid credentials' });
    }
  }
}
```

- Guard retorna/lança erro **gRPC** (`UNAUTHENTICATED`/`PERMISSION_DENIED`), não `UnauthorizedException` HTTP.
- `@GrpcStreamCall` recebe o `call` cru: o guard roda antes, mas leia metadata via `call.metadata` se precisar do usuário no service.
- Canal: TLS (`ServerCredentials.createSsl`) fora de dev, ou terminação TLS no proxy. Nunca `createInsecure()` exposto publicamente.
- JWT: segredo via `ConfigService`, expiração curta, algoritmo fixo; nunca `ignoreExpiration`.

## 2. Autorização

- Guard faz o grosso (autenticado? role?); **autorização por recurso** (este usuário pode ver este `recordId`?) fica no service, consultando o dono/escopo.
- Recurso fora do escopo → `NOT_FOUND` (não revelar existência).
- Roles via decorator (`@Roles('doctor')`) + `Reflector` no guard; nada de `if (user.role !== ...)` espalhado em handler.

## 3. Rate limiting

- HTTP: `@nestjs/throttler` com limites mais rígidos em auth.
- gRPC: throttler não cobre RPC por padrão — limitar por interceptor/guard próprio ou no proxy (Envoy/NGINX), e limitar **uploads simultâneos por usuário**.
- Limites de tamanho (`maxReceiveMessageLength`, total por arquivo) são parte da defesa contra DoS.

## 4. HTTP (lado REST do app híbrido)

- CORS: hoje `origin: '*'` em `main.ts` — restringir a origens conhecidas via config antes de produção.
- `helmet` para headers de segurança.
- Swagger (`/doc`) desabilitado ou protegido em produção.

## 5. Upload e arquivos

- Path final gerado pelo servidor (`<STORAGE_DIR>/<uuid>.<ext>`); `fileName` do cliente só como metadado (`original_name`), nunca no path → evita path traversal.
- Diretório de storage fora de qualquer pasta servida estaticamente; permissões restritas.
- MIME por allowlist + verificação de magic bytes para PDF/PNG/JPEG quando crítico.
- Detalhe e checklist: [grpc-microservices.md](grpc-microservices.md#4-upload-em-chunks-com-backpressure-rnf01-rnf02).

## 6. Segredos

- Somente em `.env`/variáveis de ambiente; `.env` e `.env.local` no `.gitignore`.
- Placeholders como `'YOUR_APP_KEY'` no código devem virar `config.getOrThrow(...)`.
- Segredo que aparecer em código, log ou commit é considerado comprometido → rotacionar.

## Fonte

Adaptado de `security-use-guards`, `security-auth-jwt`, `security-rate-limiting`, `security-sanitize-output` (kadajett/agent-nestjs-skills) e `references/authentication.md` (jeffallan/claude-skills).
