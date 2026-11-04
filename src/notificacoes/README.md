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
| `constantes.ts` | Tipos de agendamento, status de dose, canais e ações (contrato) |
| `agendamento.ts` | Calcula os próximos horários (fixo, intervalo, dias da semana, período) |
| `textos.ts` | Títulos e textos das notificações, linguagem simples |
| `notificador.ts` | Agendador local (setTimeout) que exibe o aviso via Notification API |
| `armazenamento.ts` | Guarda configurações no localStorage |
| `agendador.ts` | Agenda, lista, cancela e reagenda os lembretes |
| `TelaLembretes.tsx` | Tela (React Native) para ligar/desligar e testar |
| `EstilosNotificacoes.ts` | Estilos da tela (fontes e botões grandes) |
| `configuracao.ts` | Permissão de notificações do navegador |

Testes: `npx jest src/notificacoes`

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
- ⬜ 10. Chamar `reagendarTodos` ao abrir o app e ao voltar do segundo plano (`AppState`)
- ⬜ 11. Chamar `reagendarTodos` / `cancelarLembretesMedicamento` nas telas de cadastro de medicamento
- ⬜ 12. Adicionar o plugin no `app.json` do app principal

**Registro da dose (RF08)**
- ⬜ 13. Cliente da API: `POST /doses` e `PATCH /doses/{id}` com `Authorization: Bearer`
- ⬜ 14. Ouvir o toque/botão da notificação (`addNotificationResponseReceivedListener`)
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
