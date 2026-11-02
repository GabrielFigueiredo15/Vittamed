# Notificações — Vittamed (parte do Catter)

Lembretes locais das doses com `expo-notifications`, no mesmo padrão do projeto
de referência (Expo, JavaScript, `Styles`, `AsyncStorage`, `Alert`).

## Instalação

```bash
npx expo install expo-notifications expo-device @react-native-async-storage/async-storage
```

No `app.json`, dentro de `"expo"`:

```json
"plugins": [["expo-notifications", { "color": "#000000" }]]
```

## Como usar no App.js

```js
import TelaLembretes from './src/notificacoes/TelaLembretes';

// medicamentos = resposta de GET /medicamentos
<TelaLembretes medicamentos={medicamentos} />
```

Sempre que um medicamento for criado, editado ou excluído:

```js
import { reagendarTodos, cancelarLembretesMedicamento } from './src/notificacoes/agendador';

await reagendarTodos(listaAtualizada);       // depois de criar/editar
await cancelarLembretesMedicamento(med.id);  // depois de excluir
```

## Arquivos

| Arquivo | O que faz |
|---|---|
| `constantes.js` | Tipos de agendamento, status de dose, canais e ações (contrato) |
| `agendamento.js` | Calcula os próximos horários (fixo, intervalo, dias da semana, período) |
| `textos.js` | Títulos e textos das notificações, linguagem simples |
| `configuracao.js` | Permissão, canais do Android e botões Tomei/Adiar/Não tomei |
| `agendador.js` | Agenda, lista, cancela e reagenda os lembretes |
| `TelaLembretes.js` | Tela para ligar/desligar e testar os lembretes |
| `EstilosNotificacoes.js` | Estilos da tela (fontes e botões grandes) |

Testes: `npx jest src/notificacoes`

## Microtarefas

Legenda: ✅ feito · ⬜ a fazer

**Base**
- ✅ 1. Constantes do contrato (tipos de agendamento, status de dose)
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
