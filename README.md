# Projeto Plexus: Visão e Arquitetura

## 1. O Contexto do Nome "Plexus"

Na anatomia humana, um *Plexo* (como o plexo nervoso ou vascular) é uma rede complexa e vital de ramificações que garante a comunicação ultrarrápida e o transporte de recursos entre o sistema nervoso central e o resto do corpo.

No nosso contexto de engenharia, **Plexus** representa exatamente a arquitetura do projeto: uma malha de comunicação de alta performance (gRPC/HTTP2) onde o Next.js e o NestJS trocam informações vitais (dados clínicos e arquivos pesados) através de contratos estritos (Protobuf) e fluxos contínuos (Streams), operando como um único organismo vivo, rápido e resiliente.

## 2. Objetivo do Projeto

Desenvolver um sistema de gestão para clínicas (médicas/odontológicas) que atue como um "laboratório de alta engenharia". O foco principal **não** é criar regras de negócio complexas de saúde, mas sim utilizar esse escopo para **dominar o gRPC, Protocol Buffers e manipulação avançada de File System (I/O)**, garantindo escalabilidade, tipagem estrita de ponta a ponta e uso eficiente de memória.

## 3. Stack Tecnológico Base

* **Frontend / BFF:** Next.js (App Router, Server Components e Server Actions atuando como clientes gRPC).
* **Backend (Microserviço):** NestJS.
* **Comunicação & Contratos:** gRPC e Protocol Buffers.
* **Banco de Dados:** PostgreSQL.
* **Linguagem:** TypeScript.

## 4. Features e Casos de Uso

O escopo foi desenhado para testarmos todos os cenários de carga do gRPC aliados ao File System do Node.js:

* **Feature A: Gestão de Pacientes (Unary RPC)**
* *Ação:* Cadastro de pacientes e agendamentos estruturados.
* *Objetivo Técnico:* Validar requisições e respostas simples (Texto/JSON-like), garantindo o funcionamento do contrato Protobuf e a latência mínima em operações CRUD padrão.


* **Feature B: Upload de Exames Médicos (Client Streaming)**
* *Ação:* Formulário misto onde o médico envia metadados do exame junto com o arquivo físico pesado (ex: Radiografia em alta resolução).
* *Objetivo Técnico:* Usar o padrão `oneof` no Protobuf. O frontend enviará os dados estruturados no primeiro "chunk" e os bytes do arquivo nos seguintes. O backend gravará diretamente no File System (`fs.createWriteStream`) com baixíssimo consumo de RAM (Non-blocking I/O).


* **Feature C: Exportação de Prontuários e Faturamento (Server Streaming)**
* *Ação:* Geração de planilhas (XLSX/CSV) ou PDFs pesados com o histórico de consultas e balanço financeiro da clínica.
* *Objetivo Técnico:* O NestJS processará a compilação do arquivo no disco e fará o *stream* de leitura (`fs.createReadStream`) de volta para o Next.js repassar ao usuário, testando o controle de fluxo (*backpressure*).

* **Feature D: Chat em tempo Real (Server Streaming)**
* *Ação:* Um chat em tempo real.
* *Objetivo Técnico:* Uma comunicação em tempo real bidirecional por meio da comunicação gRCP.

## 5. Nossos Padrões de Engenharia (Guia de Estilo e Arquitetura)

Para garantir que o código tenha qualidade de software sênior desde o dia zero, adotaremos as seguintes premissas:

1. **Nomenclatura Padrão:** O código será escrito integralmente com variáveis, classes e, **estritamente**, nomes de funções em inglês (ex: `processPatientRecord`, `streamFileToDisk`).
2. **Documentação Profissional:** Proibido o uso de comentários *inline* para explicar código óbvio. Utilizaremos **docstrings** completas e formatadas nas assinaturas de classes, interfaces e métodos para que a IDE (Cursor/Windsurf/VSCode) possa fornecer inteligência de contexto.
3. **Acesso a Dados Otimizado:** Vamos evitar o overhead de ORMs tradicionais em consultas de leitura complexas. Priorizaremos estratégias de *Fast-Path querysets* direto no banco, prevenindo o problema de *N+1 queries* logo na modelagem estrutural.
4. **Isolamento de Domínio:** O Monorepo será fatiado de forma que o frontend não conheça regras de negócio e o backend não conheça regras de renderização. O único elo de acoplamento será o pacote compartilhado `packages/contracts` (onde viverão os arquivos `.proto`).

## 6. Como executar o projeto

### Pré-requisitos

* Node.js 24+
* npm
* Docker e Docker Compose

### 1. Instalar as dependências

```bash
npm install
```

### 2. Configurar as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto. Ele é lido pela aplicação e pelo CLI de migrations. Um `.env.local`, se existir, sobrescreve os valores apenas na aplicação.

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=plexus
DB_PASSWORD=plexus
DB_DATABASE=plexusdb
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `8080` | Porta HTTP (Swagger) |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5433` | Porta do PostgreSQL exposta pelo Docker |
| `DB_USERNAME` | `plexus` | Usuário do banco |
| `DB_PASSWORD` | `plexus` | Senha do banco |
| `DB_DATABASE` | `plexusdb` | Nome do banco |
| `GRPC_URL` | `localhost:50051` | Endereço do servidor gRPC (opcional) |
| `NODE_ENV` | — | Com `production`, o reflection gRPC fica desligado (opcional) |

### 3. Subir o banco de dados

```bash
docker compose up -d
```

Sobe o PostgreSQL 17 na porta `5433` e o pgAdmin em `http://localhost:5050` (login `admin@plexus.com` / `plexus`).

### 4. Rodar as migrations

```bash
npm run migration:run
```

| Script | Descrição |
|--------|-----------|
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:revert` | Desfaz a última migration aplicada |
| `npm run migration:show` | Lista as migrations e o status (`[X]` aplicada) |
| `npm run migration:generate -- src/database/migrations/<Nome>` | Gera uma migration a partir da diferença entre as entities e o banco |
| `npm run migration:create -- src/database/migrations/<Nome>` | Cria uma migration vazia |

### 5. Iniciar a API

```bash
npm run start:dev
```

* HTTP: `http://localhost:8080`
* Swagger: `http://localhost:8080/doc`
* gRPC: `localhost:50051`, com reflection habilitado fora de produção (ex.: `grpcurl -plaintext localhost:50051 list`)

### Qualidade e testes

```bash
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run test:e2e
```