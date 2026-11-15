# Notificações — Vittamed

Lembretes das doses em React Native: Android (Expo) e web (react-native-web + Vite).

O app completo (login, início, remédios, orientações, perfil) fica em `src/interface`; este módulo cuida só dos lembretes.

## Rodar no VS Code

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes
npm run simular  # mostra próximos horários
```

Os avisos usam a Notification API do navegador e só tocam com a página aberta.
O app inicia com medicamentos de exemplo; cadastros feitos pela tela são salvos no navegador ou no aparelho.

Sempre que um medicamento for criado, editado ou excluído:

```js
import { reagendarTodos, cancelarLembretesMedicamento } from './src/notificacoes/agendador';

await reagendarTodos(listaAtualizada);       // depois de criar/editar
await cancelarLembretesMedicamento(med.id);  // depois de excluir
```

## Arquivos

| Arquivo | O que faz |
|---|---|
| `tipos.ts` | Interfaces do contrato (Medicamento, Agendamento, Dose, Orientacao) |
| `apiDoses.ts` | Cliente autenticado para criar e atualizar doses na API |
| `respostasNotificacao.native.ts` | Registra ações e ouve toques e botões das notificações nativas |
| `constantes.ts` | Tipos de agendamento, status de dose, canais e ações (contrato) |
| `agendamento.ts` | Calcula os próximos horários (fixo, intervalo, dias da semana, período) |
| `textos.ts` | Títulos e textos das notificações, linguagem simples |
| `notificador.ts` | Agendador local (setTimeout) que exibe o aviso via Notification API |
| `armazenamento.ts` | Guarda configurações no localStorage |
| `agendador.ts` | Agenda, lista, cancela e reagenda os lembretes |
| `TelaMedicamentos.tsx` | Cadastro, edição e exclusão local de medicamentos com atualização dos lembretes |
| `TelaLembretes.tsx` | Tela (React Native) para ligar/desligar e testar |
| `EstilosNotificacoes.ts` | Estilos da tela (fontes e botões grandes) |
| `configuracao.ts` | Permissão de notificações do navegador |

Testes: `npx jest src/notificacoes`

Ao tocar em uma notificação nativa ou em uma de suas ações, o app recebe a resposta por `addNotificationResponseReceivedListener`, inclusive quando foi iniciado a partir do toque. Os botões Tomei / Adiar / Não tomei registram a dose no aparelho e ela é enviada para a API.

### Integração com a API (remédios, doses e orientações)

Feita em `src/api` (não neste módulo):

| Arquivo | O que faz |
|---|---|
| `src/api/cliente.ts` | Chamadas HTTP com `Authorization: Bearer`, renovação do token e erros |
| `src/api/filaSync.ts` | Fila de envio (sobrevive ao fechar o app) e ligação id local ↔ id da API |
| `src/api/sincronizacao.ts` | Envia a fila (`POST`/`PATCH`/`DELETE` em `/medicamentos`, `/doses` e `/orientacoes`), baixa os três com `GET` e junta com a cópia local |

- A cópia no aparelho continua sendo a que as telas e os lembretes usam; nada espera a internet.
- Cada mudança entra na fila e é enviada em ordem quando houver internet e login. Sem conexão, fica guardada.
- O remédio é enviado antes das doses dele (o `POST /doses` exige que o remédio exista na API).
- Ao entrar e ao abrir o app, depois de esvaziar a fila, o app baixa o que mudou em outros aparelhos da mesma conta (família/cuidadora, RF03).
- Foto escolhida no aparelho (data URI) ainda não vai para a API: o contrato só guarda `foto_url` e ainda não há upload. O "início da validade" da orientação também fica só no aparelho (a API só tem `validade`).

`apiDoses.ts` (cliente isolado da tarefa 13) não é mais usado pelo app e pode ser removido.

### Aviso à família: token de push (RF09)

| Arquivo | O que faz |
|---|---|
| `push.native.ts` | Pega o token de push do aparelho (Android/iOS); explica o motivo quando não dá (Expo Go, emulador, sem permissão, sem projectId) |
| `push.ts` | Versão web: sem push remoto |
| `src/api/aparelho.ts` | Registra o token na conta ao entrar, ao abrir o app e quando o token muda; remove ao sair |

O endpoint ainda **não existe no backend**. Formato proposto:

- `PUT /aparelhos` com `{ "token_push": "...", "plataforma": "android" | "ios" }` — guarda (ou move) o token para a conta do Bearer;
- `DELETE /aparelhos/{token_push}` — ao sair da conta;
- ao registrar `status=nao_tomada`, o backend envia push pelo serviço do Expo aos **outros** aparelhos da conta, com `channelId: "familia"` e `data: { "tipo": "aviso_familia", "medicamentoId", "horarioPrevisto" }`. Tocar no aviso abre "Avisos do perfil compartilhado".

Enquanto o endpoint não existir, o registro fica pendente e é tentado de novo a cada abertura, sem erro na tela.

**Gerar a development build (Expo Go não recebe push remoto no Android):**

1. Projeto EAS já criado: `@gabrielcatter/vittamed` (`extra.eas.projectId` no `app.json`).
2. Firebase (o mesmo projeto do backend serve): adicionar um app Android com o pacote `com.vittamed.app`, baixar o `google-services.json` para a raiz e pôr `"googleServicesFile": "./google-services.json"` em `expo.android` no `app.json`.
3. Enviar a chave do FCM V1 para o EAS: `npx eas-cli credentials` → Android → *Google Service Account Key for Push Notifications (FCM V1)*.
4. `npx eas-cli build --profile development --platform android` e instalar o APK no celular.
5. Rodar `npx expo start --dev-client` e abrir pelo app instalado.

## Microtarefas

Legenda: ✅ feito · ⬜ a fazer

**Base**
- ✅ 1. Tipos e constantes do contrato (tipos de agendamento, status de dose)
- ✅ 2. Calcular próximos horários a partir do `Agendamento` (+ testes)
- ✅ 3. Textos das notificações (dose, adiada, não tomada, orientação vencida)
- ✅ 4. Pedir permissão, criar canais do Android e registrar os botões da notificação

**Lembretes de dose (RF07)**
- ✅ 5. Agendar o lembrete de uma dose em horário exato
- ✅ 6. Cancelar lembretes de um medicamento / de todos
- ✅ 7. Reagendar tudo respeitando o limite de 64 do iOS
- ✅ 8. Notificação de teste
- ✅ 9. Tela de lembretes (ligar/desligar salvo no AsyncStorage, testar, abrir configurações)
- ✅ 10. Chamar `reagendarTodos` ao abrir o app e ao voltar do segundo plano (`AppState`)
- ✅ 11. Chamar `reagendarTodos` / `cancelarLembretesMedicamento` nas telas de cadastro de medicamento
- ✅ 12. Adicionar o plugin no `app.json` do app principal

**Registro da dose (RF08)**
- ✅ 13. Cliente da API com `Authorization: Bearer` e renovação do token (`src/api/cliente.ts`); doses enviadas por `POST /doses` + `PATCH /doses/{id}`
- ✅ 14. Ouvir o toque/botão da notificação (`addNotificationResponseReceivedListener`)
- ✅ 15. Botão **Tomei** → `status=tomada` no aparelho e na API
- ✅ 16. Botão **Adiar** → `status=adiada` + `novo_horario` no aparelho e na API, e novo lembrete
- ✅ 17. Botão **Não tomei** → `status=nao_tomada` no aparelho e na API
- ✅ 18. Tela de confirmação da dose (aberta ao tocar na notificação) com botões grandes

**Orientações (RF14)**
- ✅ 19. Lembrete diário às 9h para orientações vencidas e não concluídas, com as orientações vindas da API (`/orientacoes`)
- ✅ 20. Cancelar o lembrete quando a orientação for concluída ou excluída

**Aviso à família (RF09)**
- ✅ 21. Token de push do aparelho registrado na conta (`push.native.ts`, `src/api/aparelho.ts`); falta o FCM no Android e o endpoint no backend para funcionar de ponta a ponta
- ⬜ 22. Combinar com o backend um endpoint para guardar tokens e disparar o aviso quando `status=nao_tomada`

**Fechamento**
- ⬜ 23. Testar em Android e iOS reais (app fechado, tela bloqueada, modo silencioso)
