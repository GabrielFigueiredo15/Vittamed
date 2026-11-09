# Notificações — Vittamed

Lembretes das doses em React Native (web, via react-native-web + Vite), sem Expo.

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

Ao tocar em uma notificação nativa ou em uma de suas ações, o app recebe a resposta por `addNotificationResponseReceivedListener`, inclusive quando foi iniciado a partir do toque. Nesta etapa a resposta é identificada e exibida; os botões ainda não atualizam o status da dose na API. Essa integração está nas tarefas 15–18.

### Estado da integração com a API de doses

O cliente abaixo está implementado e seus testes usam respostas simuladas. **Ele ainda não foi conectado nem validado contra o backend real.** A tarefa 13 cobre somente a implementação isolada do cliente; não significa que a integração com a API esteja concluída.

Antes de usar em produção, confirme com o backend:

- a URL base e a forma de obter/renovar o token;
- os campos aceitos por `POST /doses` e `PATCH /doses/{id}`;
- se ambos retornam a dose completa em JSON e quais são os formatos de erro;
- os códigos HTTP e eventuais requisitos adicionais de autenticação.

Se o backend não retornar uma dose completa em JSON, será necessário ajustar o cliente ao contrato real. As telas e os botões do app ainda não chamam este cliente; isso será feito nas tarefas de fluxo de registro da dose.

O cliente da API recebe URL e token na criação e devolve a dose retornada pelo backend:

```ts
import { criarClienteDoses } from './src/notificacoes/apiDoses';

const apiDoses = criarClienteDoses({
  baseUrl: 'https://api.exemplo.com',
  token: tokenDeAcesso,
});

const dose = await apiDoses.criarDose({
  medicamento_id: 'med-123',
  horario_previsto: new Date().toISOString(),
});
await apiDoses.atualizarDose(dose.id, { status: 'tomada' });
```

O cliente espera que os dois endpoints retornem o objeto `Dose` em JSON. A URL e o token devem vir da configuração/autenticação do app; não os grave no código-fonte.

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
- ✅ 11. Chamar `reagendarTodos` / `cancelarLembretesMedicamento` no cadastro local de medicamentos
- ✅ 12. Adicionar o plugin `expo-notifications` no `app.json` do app principal

**Registro da dose (RF08)**
- ✅ 13. Implementar cliente isolado para `POST /doses` e `PATCH /doses/{id}` com `Authorization: Bearer` (contrato real ainda não validado)
- ✅ 14. Ouvir o toque/botão da notificação (`addNotificationResponseReceivedListener`)
- ⬜ 15. Botão **Tomei** → `PATCH` `status=tomada`
- ⬜ 16. Botão **Adiar** → `PATCH` `status=adiada` + `novo_horario` e agendar novo lembrete
- ⬜ 17. Botão **Não tomei** → `PATCH` `status=nao_tomada`
- ⬜ 18. Tela de confirmação da dose (aberta ao tocar na notificação) com botões grandes

**Orientações (RF14)**
- ⬜ 19. Buscar `GET /orientacoes` e agendar lembrete diário para as vencidas e não concluídas
- ⬜ 20. Cancelar o lembrete quando a orientação for concluída ou excluída

**Aviso à família (RF09)**
- ⬜ 21. Registrar token de push do aparelho (exige *development build*; Expo Go não recebe push remoto no Android)
- ⬜ 22. Combinar com o backend um endpoint para guardar tokens e disparar o aviso quando `status=nao_tomada`

**Fechamento**
- ⬜ 23. Testar em Android e iOS reais (app fechado, tela bloqueada, modo silencioso)
