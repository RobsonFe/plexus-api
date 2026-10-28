# LGPD – Lei Geral de Proteção de Dados (Brasil)

Camada LGPD de [SKILL.md](SKILL.md) para o **Plexus** (gestão clínica). Carregue quando o diff tocar dados de paciente (nome, CPF, telefone), notas clínicas, arquivos médicos, logs ou respostas que exponham esses dados.

> **Atenção:** o Plexus trata **dados de saúde**, que são **dados pessoais sensíveis** (Art. 5º II e Art. 11). O padrão de exigência aqui é mais alto que o de um sistema comum.

## Visão geral

- **Lei**: 13.709/2018 (LGPD). Vigência desde 14/08/2018; alterações pela Lei 13.853/2019 (ANPD).
- **Objetivo**: Proteger direitos fundamentais de liberdade, privacidade e livre desenvolvimento da personalidade da pessoa natural.
- **Âmbito**: Qualquer operação de tratamento de dados pessoais, em qualquer meio, por pessoa natural ou jurídica (pública ou privada), desde que:
  - a operação ocorra no território nacional; ou
  - a atividade vise oferta de bens/serviços ou tratamento de dados de pessoas localizadas no Brasil; ou
  - os dados tenham sido coletados no território nacional (titular no Brasil no momento da coleta).

**Exceções** (Art. 4º): uso exclusivamente particular e não econômico; fins jornalísticos/artísticos; fins acadêmicos (com observância dos arts. 7º e 11); segurança pública, defesa nacional, segurança do Estado, investigação e repressão de infrações penais (legislação específica); dados provenientes de fora do Brasil sem comunicação/compartilhamento/transferência internacional com agentes brasileiros (com ressalvas).

## Conceitos essenciais (Art. 5º)

| Termo | Definição resumida |
|-------|--------------------|
| **Dado pessoal** | Informação relacionada a pessoa natural identificada ou identificável |
| **Dado sensível** | Origem racial/étnica, convicção religiosa, opinião política, filiação sindical/religiosa/filosófica/política, saúde, vida sexual, dado genético ou biométrico vinculado a pessoa natural |
| **Titular** | Pessoa natural a quem se referem os dados |
| **Controlador** | Quem decide sobre o tratamento |
| **Operador** | Quem trata em nome do controlador |
| **Encarregado (DPO)** | Canal entre controlador, titulares e ANPD |
| **Tratamento** | Coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração |
| **Consentimento** | Manifestação livre, informada e inequívoca para finalidade determinada |

## Princípios (Art. 6º)

Toda atividade de tratamento deve observar a boa-fé e:

1. **Finalidade** – Propósitos legítimos, específicos, explícitos e informados ao titular; sem tratamento posterior incompatível.
2. **Adequação** – Compatibilidade com as finalidades informadas e o contexto.
3. **Necessidade** – Mínimo necessário; dados pertinentes, proporcionais e não excessivos.
4. **Livre acesso** – Consulta facilitada e gratuita sobre forma, duração e integralidade dos dados.
5. **Qualidade** – Exatidão, clareza, relevância e atualização conforme a finalidade.
6. **Transparência** – Informações claras, precisas e acessíveis sobre tratamento e agentes (respeitados segredos comercial e industrial).
7. **Segurança** – Medidas técnicas e administrativas contra acessos não autorizados e situações ilícitas ou acidentais (destruição, perda, alteração, comunicação, difusão).
8. **Prevenção** – Medidas para evitar danos.
9. **Não discriminação** – Nenhum tratamento para fins discriminatórios ilícitos ou abusivos.
10. **Responsabilização e prestação de contas** – Demonstração de medidas eficazes de conformidade.

## Bases legais para tratamento (Art. 7º)

O tratamento de **dados pessoais** só pode ocorrer quando houver ao menos uma das hipóteses:

- I – Consentimento do titular  
- II – Obrigação legal ou regulatória do controlador  
- III – Execução de políticas públicas pela administração pública (conforme Cap. IV)  
- IV – Estudos por órgão de pesquisa (anonimização quando possível)  
- V – Execução de contrato ou procedimentos preliminares a pedido do titular  
- VI – Exercício regular de direitos em processo judicial, administrativo ou arbitral  
- VII – Proteção da vida ou incolumidade física do titular ou de terceiro  
- VIII – Tutela da saúde (profissionais/serviços de saúde ou autoridade sanitária)  
- IX – Interesses legítimos do controlador ou terceiro, exceto se prevalecerem direitos e liberdades fundamentais do titular  
- X – Proteção do crédito  

**Consentimento (Art. 8º)**: escrito ou outro meio que demonstre vontade; cláusula destacada se escrito; ônus da prova no controlador; vedado tratamento com vício de consentimento; finalidades determinadas (autorizações genéricas nulas); revogação a qualquer tempo, gratuita e facilitada.

Dados **manifestamente públicos** pelo titular podem ser tratados sem consentimento, respeitados direitos e princípios. Dispensa de consentimento **não** dispensa demais obrigações da lei.

## Dados sensíveis (Art. 11)

Tratamento de **dados sensíveis** somente:

- Com **consentimento específico e destacado** para finalidades específicas; ou  
- **Sem consentimento** quando indispensável para: (a) obrigação legal/regulatória; (b) políticas públicas; (c) estudos por órgão de pesquisa (anonimização quando possível); (d) exercício regular de direitos (contrato/processo); (e) proteção da vida ou incolumidade física; (f) tutela da saúde (profissionais/serviços/autoridade sanitária); (g) prevenção à fraude e segurança do titular (identificação/autenticação em sistemas), respeitados direitos do titular.

**Vedações**: compartilhamento de dados de saúde entre controladores com objetivo de vantagem econômica, exceto nas hipóteses legais (ex.: portabilidade a pedido do titular, prestação de serviços de saúde). Operadoras de planos de saúde não podem usar dados de saúde para seleção de riscos na contratação ou exclusão de beneficiários.

## Crianças e adolescentes (Art. 14)

- Tratamento no **melhor interesse** da criança/adolescente.  
- Dados de **crianças**: consentimento **específico e em destaque** de pelo menos um dos pais ou responsável legal.  
- Controladores devem manter informação pública sobre tipos de dados, forma de uso e exercício dos direitos (Art. 18).  
- Coleta sem consentimento só quando necessária para contatar pais/responsável (uso único, sem armazenamento) ou para proteção; não repassar a terceiros sem o consentimento do § 1º.  
- Não condicionar participação em jogos/aplicações à coleta de dados além do estritamente necessário.

## Direitos do titular (Art. 18)

O titular tem direito a obter do controlador, a qualquer momento, mediante requisição:

- I – Confirmação da existência de tratamento  
- II – Acesso aos dados  
- III – Correção de dados incompletos, inexatos ou desatualizados  
- IV – Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou em desconformidade com a lei  
- V – Portabilidade dos dados a outro fornecedor (conforme regulamentação da ANPD, segredos comercial e industrial)  
- VI – Eliminação dos dados tratados com consentimento (exceto hipóteses do Art. 16)  
- VII – Informação sobre entidades públicas e privadas com as quais houve uso compartilhado  
- VIII – Informação sobre possibilidade de não consentir e consequências da negativa  
- IX – Revogação do consentimento (Art. 8º § 5º)  

O titular pode **peticionar à ANPD** contra o controlador e **opor-se** a tratamento baseado em dispensa de consentimento em caso de descumprimento da lei. Requerimento deve ser atendido **sem custos** para o titular, nos prazos regulamentares.

## ANPD (Autoridade Nacional de Proteção de Dados)

- Entidade responsável por **zelar, implementar e fiscalizar** o cumprimento da LGPD em todo o território nacional.  
- Emite regulamentações, orientações e pode solicitar **relatório de impacto à proteção de dados pessoais (RIPD)** em tratamentos de maior risco (ex.: baseados em interesse legítimo).  
- Aplicação de sanções administrativas (multas, advertências, etc.) conforme a lei.

## Término e eliminação (Arts. 15 e 16)

O tratamento termina quando: (I) a finalidade foi alcançada ou os dados deixaram de ser necessários; (II) fim do período de tratamento; (III) comunicação do titular (incl. revogação de consentimento), resguardado interesse público; (IV) determinação da ANPD em caso de violação.

Após o término, os dados devem ser **eliminados**, exceto quando a conservação for permitida (ex.: obrigação legal/regulatória, estudo com anonimização, etc.).

## Implementação no Plexus — o que revisar

> **Premissa:** a LGPD exige **minimização, segurança e direitos do titular**. Mascaramento é medida proporcional ao risco e contexto; em dado de saúde, o risco é alto por definição.

### Mapa de dados do domínio clínico

| Dado | Onde | Tier | Regra |
|------|------|------|-------|
| `document_cpf` | `patients` | **Alto** | normalizado, `unique`; mascarado em qualquer resposta de listagem/terceiro (`***.456.789-**`); nunca em log |
| `full_name`, `phone` | `patients` | Médio | só para quem tem acesso ao paciente; nunca em log |
| `doctor_notes` | `clinical_records` | **Sensível (saúde)** | só para profissional autorizado; nunca em log, erro ou métrica |
| arquivo médico (radiografia/PDF) | disco (`disk_path`) | **Sensível (saúde)** | fora de pasta pública; acesso só via API autorizada; path não exposto |
| `original_name`, `mime_type`, `size_bytes` | `medical_files` | Baixo/Médio | `original_name` pode conter nome do paciente → tratar como PII |

### Checklist de revisão (diff)

- [ ] **Logs:** nenhum `Logger`/`console` com CPF, nome, telefone, `doctorNotes`, `fileName` ou conteúdo de chunk. Logar IDs.
- [ ] **Erros:** mensagens de `RpcException`/validação não ecoam o valor recebido (ex.: "CPF 123... inválido").
- [ ] **Respostas:** mensagem gRPC/DTO devolve o mínimo (Art. 6º III). Nada de entity inteira, `disk_path` absoluto ou notas em listagem.
- [ ] **Autorização:** acesso a prontuário/arquivo exige usuário autenticado **e** vínculo/permissão com o paciente; fora do escopo → `NOT_FOUND`.
- [ ] **Armazenamento:** arquivo médico em diretório não servido estaticamente, permissões restritas; criptografia em repouso avaliada (disco/volume ou aplicação).
- [ ] **Transporte:** gRPC com TLS fora de dev; reflection desligado em produção.
- [ ] **Exclusão:** apagar registro também trata o arquivo em disco (cascade do banco não apaga arquivo). Considerar retenção legal de prontuário antes de eliminar (ver abaixo).
- [ ] **Ambientes não produtivos:** sem dados reais de paciente em seeds, fixtures, testes ou exemplos de doc.
- [ ] **Swagger/exemplos:** `@ApiProperty({ example })` com dados fictícios (CPF de teste), nunca reais.
- [ ] **Novos campos sensíveis** (ex.: diagnóstico, CID, data de nascimento) → base legal documentada (Art. 11 II "f" — tutela da saúde) e decisão explícita (pergunte antes).

### Base legal típica

- Tratamento por profissional/serviço de saúde: **Art. 11, II, "f" (tutela da saúde)** — dispensa consentimento, **não** dispensa os demais princípios (finalidade, necessidade, segurança, transparência).
- Compartilhamento de dados de saúde com terceiros para vantagem econômica é **vedado** (Art. 11 §4º), salvo exceções legais.

### Retenção de prontuário

Prontuário do paciente tem prazo mínimo de guarda definido em legislação específica (Lei 13.787/2018 — prontuário eletrônico — e normas do CFM). Isso conflita com "eliminar quando não necessário": **não implementar exclusão física de prontuário sem decisão jurídica documentada**. Pergunte antes.

### Anti-patterns

| ❌ Não fazer | ✅ Fazer |
|-------------|---------|
| Mascarar só no frontend (Next.js) | Mascarar/omitir no backend (mensagem gRPC/DTO) |
| `this.logger.log(\`Saving ${JSON.stringify(metadata)}\`)` | `this.logger.log(\`Saving record ${recordId} (${totalBytes} bytes)\`)` |
| Usar `fileName` do cliente no path em disco | UUID gerado pelo servidor; nome original só como metadado |
| Seeds/testes com CPF real | CPF gerado válido de teste |
| Devolver `disk_path` ao cliente | Devolver `recordId`/ID do arquivo; download por endpoint autorizado |

## Checklist geral para sistemas

- [ ] Mapear dados pessoais e sensíveis; documentar finalidade e base legal (Art. 7º ou 11).
- [ ] Respeitar princípios: necessidade (mínimo de dados), transparência, segurança, prevenção.
- [ ] Canais para direitos do titular (acesso, correção, portabilidade, informação), respeitada a retenção legal de prontuário.
- [ ] Avaliar necessidade de RIPD (dado sensível em larga escala é forte candidato).
- [ ] Plano de resposta a incidente (Art. 48: comunicar ANPD e titular em incidente relevante).
- [ ] Logs/analytics sem PII identificável.

## Referência oficial

- Lei 13.709/2018 (texto compilado): [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- ANPD – orientações e perguntas frequentes: [gov.br/anpd](https://www.gov.br/anpd/pt-br)
- Consulta por artigo: [lgpd-reference.md](lgpd-reference.md)

**Aviso:** esta camada resume a LGPD para apoio em análise e implementação. Para decisões jurídicas (base legal, retenção, RIPD), consulte a lei, a ANPD, o CFM e assessoria jurídica.
