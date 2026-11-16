# Vittamed — Contrato da API (Backend)

Backend do app de organização de medicamentos para pessoas idosas.
Expõe **autenticação**, **CRUD** (Firestore), **consulta de remédios** e
**assistente de IA**. Este documento é o contrato para o time de front.

- **Versão:** `0.4.0`
- **Base URL:** `https://gate-mobile-vitamed.fastapicloud.dev`
- **Docs interativa (Swagger):** `GET /docs`
- **OpenAPI JSON:** `GET /openapi.json`
- **Formato:** JSON. Datas em **ISO 8601 / UTC** (`2026-10-28T08:00:00Z`).

---

## 1. Autenticação

Fluxo: o app chama **nossa API** (nunca o Firebase direto).

1. `POST /auth/registrar` ou `POST /auth/login` → recebe `id_token` + `refresh_token`.
2. Envia o `id_token` em **todas** as rotas protegidas:
   `Authorization: Bearer <id_token>`
3. O `id_token` expira em **1h** (`expira_em: 3600`). Quando expirar, chame
   `POST /auth/refresh` com o `refresh_token` para obter um novo.
4. **Logout** é no cliente: descarte os tokens do dispositivo.

Todos os dados são **isolados por usuário** (`uid` extraído do token). Um
usuário nunca enxerga dados de outro.

### Erros de autenticação

| HTTP | Quando |
|---|---|
| `401` | Sem header `Authorization`, token inválido ou expirado (`"token invalido ou expirado"`) |
| `403` | Conta desativada no Firebase |
| `429` | Muitas tentativas seguidas (bloqueio temporário do Firebase) |
| `502` | Falha de rede ao falar com o Firebase |
| `503` | Credencial / API key do Firebase não configurada no servidor |

---

## 2. Endpoints de Auth (públicos)

### `POST /auth/registrar`
Cria conta (e-mail/senha).
```json
// request
{ "email": "maria@ex.com", "senha": "Senha12345" }   // senha mín. 6 chars
// response 200
{
  "uid": "WogjF5qBg7...",
  "email": "maria@ex.com",
  "id_token": "eyJhbGci...",
  "refresh_token": "AMf-vBx...",
  "expira_em": 3600
}
```
Erros: `400 e-mail ja cadastrado`, `400 e-mail invalido`, `400 senha muito curta (min. 6)`, `422` corpo inválido.

### `POST /auth/login`
Mesmo corpo e resposta do registrar.
Erros: `401 e-mail ou senha invalidos`, `403 conta desativada`, `429 muitas tentativas, tente mais tarde`.

### `POST /auth/recuperar-senha`
Dispara o e-mail de redefinição de senha do Firebase. O e-mail traz um link
com o código de redefinição (`oobCode`); ao abrir, o usuário define a nova
senha na página do Firebase.

Por segurança responde **sempre `200`**, exista ou não o e-mail (não revela
quais contas existem). Só falha em `429`, `502` ou `503`.
```json
// request
{ "email": "maria@ex.com" }
// response 200
{ "enviado": true, "mensagem": "se o e-mail existir, enviamos o link" }
```

### `POST /auth/refresh`
Renova o `id_token`.
```json
// request
{ "refresh_token": "AMf-vBx..." }
// response 200  -> mesmo shape da sessão (email vem null aqui)
{ "uid": "WogjF5qBg7...", "email": null, "id_token": "eyJ...", "refresh_token": "AMf...", "expira_em": 3600 }
```
Erro: `401` refresh_token inválido/expirado → mandar o usuário para o login.

---

## 3. Perfil do paciente (protegido)

1 perfil por conta. Compartilhado por paciente/família/cuidadora (mesmas credenciais).

**Campos (`Perfil`)**

| campo | tipo | obs |
|---|---|---|
| `nome` | string | obrigatório |
| `data_nascimento` | date (`YYYY-MM-DD`) | opcional |
| `telefone` | string | opcional |
| `email` | string | opcional |
| `uid` | string | só na resposta |
| `atualizado_em` | datetime | só na resposta |

- `PUT /perfil` — cria/substitui. Body: `{nome, data_nascimento?, telefone?, email?}`
- `GET /perfil` — lê (`404` se nunca criado)
- `PATCH /perfil` — atualiza campos (todos opcionais). **Exige que o perfil já exista** (`404 perfil nao encontrado; crie antes com PUT /perfil`).

---

## 4. Medicamentos (protegido)

**Campos (`Medicamento`)**

| campo | tipo | obs |
|---|---|---|
| `nome` | string | obrigatório |
| `dosagem` | string | ex: "50mg" |
| `forma_uso` | string | comprimido, gota… |
| `agendamento` | objeto `Agendamento` | ver abaixo |
| `periodo_inicio` | date | opcional |
| `periodo_fim` | date | fim do tratamento |
| `observacoes` | string | opcional |
| `foto_url` | string | URL da foto da embalagem |
| `ativo` | bool | `false` = histórico (tratamento encerrado) |
| `id`, `criado_em`, `atualizado_em` | — | só na resposta |

**`Agendamento`**
```json
{
  "tipo": "fixo" | "intervalo" | "dias_semana",
  "horarios": ["08:00", "20:00"],   // tipo=fixo (e horários do dia em dias_semana)
  "intervalo_horas": 8,              // tipo=intervalo (1..72)
  "dias_semana": [0, 2, 4]           // tipo=dias_semana | 0=seg .. 6=dom
}
```
Validação na escrita (POST/PATCH), com `422` se violar:
- `horarios`: formato **`HH:MM` com 2 dígitos** (`00:00`..`23:59`). `"8:00"` é rejeitado → use `"08:00"`.
- `dias_semana`: inteiros de `0` a `6`.
- `horarios: null` / `dias_semana: null` são aceitos e viram `[]`.

**Rotas**
- `POST /medicamentos` → `201`
- `GET /medicamentos` → lista
- `GET /medicamentos/{med_id}`
- `PATCH /medicamentos/{med_id}` → atualização parcial
- `DELETE /medicamentos/{med_id}` → `204`. **Apaga junto** as doses, as orientações e a foto desse medicamento.
- `POST /medicamentos/{med_id}/foto` → `200` com o `Medicamento` já com a `foto_url` nova (RF05).

### `POST /medicamentos/{med_id}/foto`
Envia a foto da embalagem. O backend reduz a foto (JPEG, até 1280 px), guarda no
**Firestore** e preenche `foto_url`, então todos os aparelhos da conta veem a mesma foto.

- Corpo: `multipart/form-data` com o arquivo no campo **`foto`**.
- Formatos: JPEG, PNG ou WEBP, **até 5 MB** no envio (o picker do app já gera JPEG com `quality: 0.3`).
- Enviar de novo **substitui** a foto anterior (a antiga é apagada e o link dela para de funcionar).
- A `foto_url` é um link da própria API: `https://gate-mobile-vitamed.fastapicloud.dev/fotos/<token>`.
  Abre **sem login** (o token longo e aleatório é a "senha" do link) e pode ir direto num
  `<Image source={{ uri }}>`. Cada envio gera um link novo, então não há cache velho.

```ts
// React Native / Expo
const form = new FormData();
form.append('foto', { uri: foto.uri, name: 'foto.jpg', type: 'image/jpeg' } as any);
await fetch(`${BASE}/medicamentos/${id}/foto`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}` },   // NÃO defina Content-Type: o fetch põe o boundary
  body: form,
});
```
Erros: `404` medicamento inexistente · `413` maior que 5 MB · `415` não é imagem suportada ·
`503` Firebase não configurado no servidor.

### `GET /fotos/{token}` (público)
Devolve a imagem (`image/jpeg`) da `foto_url`. `404` se a foto foi trocada ou o remédio excluído.
Com o backend em manutenção (`PAUSE=1`), as fotos também não carregam.

> `foto_url` continua aceitando uma URL qualquer via `POST`/`PATCH /medicamentos`
> (compatível com a v0.3.0). O endpoint acima é o caminho recomendado.

---

## 5. Doses / lembretes (protegido)

Uma dose é um evento programado de um medicamento. Nasce `pendente` (padrão);
ao receber o lembrete, o usuário registra o desfecho.

**Campos (`Dose`)**

| campo | tipo | obs |
|---|---|---|
| `medicamento_id` | string | referência ao medicamento (precisa existir) |
| `horario_previsto` | datetime | quando era pra tomar |
| `status` | `pendente`\|`tomada`\|`nao_tomada`\|`adiada` | padrão `pendente` |
| `horario_registrado` | datetime | quando o usuário registrou |
| `novo_horario` | datetime | obrigatório se `status=adiada` |
| `id`, `criado_em`, `atualizado_em` | — | só na resposta |

**Rotas**
- `POST /doses` → `201`. Body: `{medicamento_id, horario_previsto, status?, novo_horario?}`
  - `404 medicamento nao encontrado` se o `medicamento_id` não existir.
- `GET /doses?medicamento_id=&status=` → histórico/lista (filtros opcionais)
- `GET /doses/{dose_id}`
- `PATCH /doses/{dose_id}` → registra desfecho (RF08). Body: `{status?, horario_registrado?, novo_horario?}` (todos opcionais)
- `DELETE /doses/{dose_id}` → `204`

Regra (POST e PATCH): `status=adiada` **exige** `novo_horario`, senão `422`.

**Aviso à família (RF09):** quando uma dose **passa a ser** `nao_tomada` (no `POST`
já com esse status, ou num `PATCH` vindo de outro status), o backend manda um push
pelo Expo para os aparelhos da conta registrados em `/aparelhos` (seção 7).
- Repetir `nao_tomada` na mesma dose (ex.: o `PATCH` logo após o `POST`) **não** reenvia.
- Header opcional **`X-Token-Push: <token_push deste aparelho>`** no `POST`/`PATCH`:
  esse aparelho não recebe o próprio aviso. Sem o header, todos os aparelhos da conta recebem.
- O envio é em segundo plano: a resposta do `/doses` não muda e não espera o push.

---

## 6. Orientações de uso (protegido)

Associadas a um medicamento (RF12/13/14).

**Campos (`Orientacao`)**

| campo | tipo | obs |
|---|---|---|
| `medicamento_id` | string | obrigatório (precisa existir) |
| `texto` | string | obrigatório |
| `validade` | date | período de validade |
| `concluida` | bool | default `false` |
| `id`, `criado_em`, `atualizado_em` | — | só na resposta |

**Rotas**
- `POST /orientacoes` → `201` (`404 medicamento nao encontrado` se o medicamento não existir)
- `GET /orientacoes?medicamento_id=` → lista (filtro opcional)
- `GET /orientacoes/{orientacao_id}`
- `PATCH /orientacoes/{orientacao_id}`
- `DELETE /orientacoes/{orientacao_id}` → `204`

---

## 7. Aparelhos e aviso à família (protegido)

Cada celular registra o **token de push do Expo** (`getExpoPushTokenAsync`) na conta
logada. É para esses aparelhos que vai o aviso de dose não tomada (RF09).

### `PUT /aparelhos`
Registra este aparelho na conta do Bearer. Se o token já estava em **outra** conta
(celular trocou de conta), ele é **movido** para esta. Pode ser chamado sempre que
o app abrir ou o token mudar.
```json
// request
{ "token_push": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "plataforma": "android" }
// response 200
{ "token_push": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "plataforma": "android" }
```
- `token_push`: formato `ExponentPushToken[...]` ou `ExpoPushToken[...]` (senão `422`).
- `plataforma`: `"android"` ou `"ios"`.

### `DELETE /aparelhos/{token_push}`
Chamado no **logout**, antes de descartar os tokens da sessão. Use `encodeURIComponent(token)`.
`204` removido · `404` token não existe ou é de outra conta.

### O push enviado
```json
{
  "title": "Dose não tomada",
  "body": "Maria não tomou Losartana 50mg das 08:00.",
  "channelId": "familia",
  "sound": "default",
  "priority": "high",
  "data": {
    "tipo": "aviso_familia",
    "medicamentoId": "abc123",
    "horarioPrevisto": "2026-11-16T11:00:00Z",
    "doseId": "def456"
  }
}
```
- O nome vem do primeiro nome do `PUT /perfil`; sem perfil: `"A dose de Losartana 50mg das 08:00 não foi tomada."`
- A hora do texto é no horário de Brasília; `horarioPrevisto` continua em UTC.
- Tokens que o Expo recusar como `DeviceNotRegistered` (app desinstalado) são apagados sozinhos.
- No Android o push só chega se o projeto Expo/EAS tiver as credenciais do FCM configuradas (parte do app).

---

## 8. Consulta de remédios (público)

Fonte: consultaremedios.com.br.

### `GET /busca?termo=&limite=&fuzzy=&score_min=`
Busca por nome/marca/princípio ativo. Ranking fuzzy tolerante a typo.
O `termo` pode ter espaços, acentos e símbolos (é codificado pelo servidor).
```json
{
  "termo": "clopidogrel", "fuzzy": true, "total": 2,
  "resultados": [
    {
      "nome": "Bissulfato de Clopidogrel Novartis 75mg...",
      "slug": "bissulfato-de-clopidogrel-novartis",
      "url": "https://...", "imagem": "https://...",
      "preco": 34.99, "preco_sem_desconto": 34.99,
      "receita": "Branca Comum...", "bula_url": "https://.../bula",
      "score": 0.95
    }
  ]
}
```
Params: `limite` (1..50, def 20), `fuzzy` (def true), `score_min` (0..1, def 0.35).
Erro: `502` falha no consultaremedios.

### `GET /bula/{slug}`
Bula completa (use o `slug` da busca).
```json
{
  "slug": "...", "titulo": "...", "imagem": "https://...",
  "principio_ativo": "Bissulfato de Clopidogrel",
  "laboratorio": "EMS S/A", "marca": null,
  "tipo_receita": "Branca Comum...",
  "bula_pdf": "https://....pdf", "bula_pro_pdf": "https://....pdf",
  "secoes": [ { "titulo": "Para que serve", "anchor": "...", "conteudo_html": "<p>..." } ]
}
```
Erros: `404` bula/slug inexistente · `502` falha no consultaremedios.

---

## 9. Assistente de IA (protegido)

### `POST /chat`
**Exige `Authorization: Bearer <id_token>`** (sem token → `401`).

Conversa ancorada em dados reais (RAG) com **guardrail clínico**: a IA **não**
dá orientação clínica individual (dose, interação, efeito adverso, mudança de
tratamento) — recusa e encaminha a médico/farmacêutico (RF16/RNF07).
```json
// request (forma simples)
{ "mensagem": "para que serve o xarelto?", "remedio": "xarelto",
  "max_tokens": 220, "temperatura": 0.3, "rag": true, "stream": false }
// response
{ "resposta": "O Xarelto serve para... Preço: R$ ...", "modelo": "nvidia/..." }
```
- `remedio` (opcional): termo de busca p/ o RAG; se vazio usa a última mensagem do usuário.
- `rag=false`: IA pura (guardrail continua ativo).
- `imagem_url`: pergunta sobre imagem (modelo vision).
- `mensagens`: histórico estilo OpenAI (`[{role, content}]`) — tem prioridade sobre `mensagem`.
  Só são aceitos `role: "user"` e `role: "assistant"`; mensagens `system` enviadas pelo cliente são descartadas
  (o prompt de sistema é sempre o do servidor). O RAG também funciona nesse modo.
- O modelo é definido pelo servidor (não há mais campo `modelo` no request).
- `temperatura` 0..2 (def 1.0) · `max_tokens` 1..4096 (def 512).
- `stream=true`: resposta em SSE (`text/event-stream`), repassando as linhas `data:` do provedor.
  Se a IA falhar no meio do stream, chega um evento final `data: {"erro": "..."}`.

Erros: `401` sem token · `422` sem `mensagem`/`mensagens` · `502` falha no provedor de IA.

---

## 10. Modo manutenção
Quando a env `PAUSE=1`, **toda** rota responde `503`:
```json
{ "pausado": true, "mensagem": "olá, estou pausado no momento!" }
```

---

## 11. Convenções gerais
- Protegidas (`/perfil`, `/medicamentos`, `/doses`, `/orientacoes`, `/aparelhos`, `/chat`) exigem `Authorization: Bearer <id_token>`.
- `401` sem token/token inválido · `403` conta desativada · `404` recurso inexistente ·
  `413` arquivo grande demais · `415` tipo de arquivo não suportado · `422` corpo inválido ·
  `429` muitas tentativas · `502` falha em serviço externo (Firebase/consultaremedios/IA) ·
  `503` servidor sem configuração ou em manutenção.
- Públicas (sem token): `/auth/*`, `/busca`, `/bula/{slug}`, `/fotos/{token}`.
- IDs de documentos são gerados pelo servidor (string).
- Nunca envie o `uid` no corpo — ele vem do token.

---

## 12. Mudanças na v0.3.0 (impacto no front)

| Mudança | Ação no app |
|---|---|
| `/chat` agora é protegido | Enviar `Authorization: Bearer <id_token>` |
| `/chat` sem campo `modelo` e sem `raw` na resposta | Remover `modelo` do request; ler só `resposta` |
| `/chat` descarta `role: system` vindo do cliente | Nada, se só manda user/assistant |
| `POST /doses` aceita `status` e `novo_horario` | Opcional (casa com `CriarDoseInput` de `apiDoses.ts`) |
| `PATCH /doses` com `status` opcional | Pode mandar só `horario_registrado`, por exemplo |
| `POST /doses` e `POST /orientacoes` validam `medicamento_id` | Tratar `404 medicamento nao encontrado` |
| `DELETE /medicamentos/{id}` apaga doses e orientações dele | Recarregar listas após excluir |
| `horarios` exige `HH:MM`; `dias_semana` 0..6; `null` vira `[]` | Formatar horas com 2 dígitos |
| `PATCH /perfil` exige perfil criado | Usar `PUT /perfil` no primeiro cadastro |
| `/auth/recuperar-senha` sempre `200` | Mostrar sempre "se o e-mail existir, enviamos o link" |
| `/auth/refresh` devolve `uid` preenchido | Opcional |
| `/bula/{slug}` diferencia `404` de `502` | Mensagem "bula não encontrada" vs "tente de novo" |
| Erros do Firebase: `403` desativada, `429` muitas tentativas, `400` e-mail inválido | Mensagens específicas |

---

## 13. Mudanças na v0.4.0 (só coisas novas, nada existente mudou)

| Novidade | Ação no app |
|---|---|
| `PUT /aparelhos` e `DELETE /aparelhos/{token_push}` | Já batem com `src/api/aparelho.ts` |
| Push `aviso_familia` (canal `familia`) quando a dose vira `nao_tomada` | Já tratado em `App.tsx` |
| Header opcional `X-Token-Push` no `POST`/`PATCH /doses` | Enviar para o próprio aparelho não receber o aviso |
| `POST /medicamentos/{id}/foto` (multipart, campo `foto`) | Enviar a foto e usar a `foto_url` devolvida |
| `GET /fotos/{token}` (público) serve a imagem da `foto_url` | Usar a `foto_url` direto no `<Image>` |
| `DELETE /medicamentos/{id}` também apaga a foto | Nada |

---

## 14. Regras de segurança do Firebase (RNF04)

O app **não** acessa o Firebase direto: tudo passa pela API, que usa o Admin SDK
(ignora as regras). Por isso as regras bloqueiam **todo** acesso de cliente:
`firestore.rules` nesta pasta (`allow read, write: if false`).

- Aplicar no console: **Firestore Database → Regras**, colar o conteúdo e **Publicar**;
  ou `firebase deploy --only firestore:rules` (usa o `firebase.json` daqui).
- O projeto **não usa o Firebase Storage** (as fotos ficam no Firestore), então não há regras de Storage a publicar.

---

## Anexo A — Rastreabilidade dos requisitos (validação frente ao PDF)

Legenda: ✅ coberto pelo backend · 🟡 backend provê os dados, mas a ação final é do app/infra · ⬜ fora do backend (front/infra).

| Req | Descrição | Status | Onde |
|---|---|---|---|
| RF01 | Criar perfil (nome, nasc., telefone, e-mail, senha) | ✅ | `POST /auth/registrar` (senha) + `PUT /perfil` (dados) |
| RF02 | Login e encerramento de sessão | ✅ | `POST /auth/login` · logout = descartar token no app |
| RF03 | Perfil acessado por pessoa/família/cuidadora (mesmas credenciais) | ✅ | Conta única → mesmo `uid`; dados em `users/{uid}` |
| RF04 | Cadastrar, ver, editar, excluir medicamentos | ✅ | `/medicamentos` (POST/GET/PATCH/DELETE) |
| RF05 | Campos do medicamento (nome, dosagem, forma, horários/freq., dias, período, obs, foto) | ✅ | `Medicamento` + `Agendamento`; foto via `POST /medicamentos/{id}/foto` (guardada no Firestore) |
| RF06 | Horário fixo / intervalo / dias específicos | ✅ | `Agendamento.tipo` (validado) |
| RF07 | Emitir lembretes das doses | 🟡 | Doses persistidas; **push/agendamento é do app (Expo Notifications)** |
| RF08 | Registrar dose tomada/não tomada/adiada + novo horário | ✅ | `PATCH /doses/{id}` |
| RF09 | Avisar familiares quando dose não tomada | ✅ | `/aparelhos` + push Expo automático quando a dose vira `nao_tomada` |
| RF10 | Fim do período: encerrar lembretes e mover p/ histórico | 🟡 | Campo `ativo` + `periodo_fim`; **transição é do app/rotina** |
| RF11 | Histórico em lista diária e calendário mensal | 🟡 | `GET /doses` (filtros status/medicamento); **render do calendário é do app** |
| RF12 | CRUD de orientações de uso | ✅ | `/orientacoes` |
| RF13 | Orientação: medicamento, texto, validade, concluir | ✅ | `Orientacao` |
| RF14 | Orientação vencida: lembrete de revisão até concluir | 🟡 | Campos `validade`/`concluida`; **lembrete é do app** |
| RF15 | Assistente de IA por texto | ✅ | `POST /chat` (autenticado) |
| RF16 | IA não dá orientação clínica; encaminha a profissional | ✅ | Guardrail no `/chat` (não pode ser sobrescrito pelo cliente) |
| RNF01 | React Native Android/iOS | ⬜ | App |
| RNF02 | Firebase Auth + Firestore | ✅ | Backend usa ambos |
| RNF03 | Exige internet | ✅ | API online |
| RNF04 | Dados protegidos por auth + regras | ✅ | Bearer + isolamento por `uid` + `firestore.rules` bloqueando acesso direto (seção 14) |
| RNF05 | Interface acessível (fontes, contraste, fonte ajustável) | ⬜ | App |
| RNF06 | Funções principais simples, poucos passos | ⬜ | App (API já é enxuta) |
| RNF07 | IA informa que não substitui orientação médica | ✅ | Guardrail |
| RNF08 | Compatibilidade com versões atuais de Android/iOS | ⬜ | App |

### Pendências que dependem do front/infra (não são do backend)
1. **Lembretes locais** (RF07/14): feitos no app. O aviso à família (RF09) sai do backend, mas o app precisa das credenciais FCM no EAS para o push chegar no Android.
2. **Foto** (RF05): o app envia o arquivo para `POST /medicamentos/{id}/foto`.
3. **Calendário mensal** (RF11): render no app a partir de `GET /doses`.
4. **Transição automática p/ histórico** (RF10): app/rotina seta `ativo=false` ao passar de `periodo_fim`.
5. **Security Rules** (RNF04): publicar `firestore.rules` no console do Firebase (seção 14).
