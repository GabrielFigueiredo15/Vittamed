// Testes de agendador.js com expo-notifications simulado.
// Rodar com: npx jest src/notificacoes
import * as Notifications from 'expo-notifications';

import {
  agendarLembreteDose,
  cancelarLembretesMedicamento,
  reagendarTodos
} from './agendador';

jest.mock('expo-notifications', () => {
  let agendadas = [];
  return {
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    scheduleNotificationAsync: jest.fn(async (req) => {
      agendadas.push(req);
      return req.identifier;
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => agendadas),
    cancelScheduledNotificationAsync: jest.fn(async (id) => {
      agendadas = agendadas.filter((n) => n.identifier !== id);
    }),
    __limpar: () => { agendadas = []; }
  };
});

const AGORA = new Date(2026, 10, 1, 10, 0);
const fixo = (id, horarios) => ({
  id, nome: `Remédio ${id}`, ativo: true, agendamento: { tipo: 'fixo', horarios }
});

beforeEach(() => Notifications.__limpar());

test('agenda com data, canal e dados para abrir a dose', async () => {
  const horario = new Date(2026, 10, 1, 20, 0);
  await agendarLembreteDose(fixo('a', ['20:00']), horario);

  const [req] = await Notifications.getAllScheduledNotificationsAsync();
  expect(req.identifier).toBe(`dose_a_${horario.getTime()}`);
  expect(req.trigger).toMatchObject({ type: 'date', date: horario, channelId: 'doses' });
  expect(req.content.data).toEqual({
    tipo: 'dose', medicamentoId: 'a', horarioPrevisto: horario.toISOString()
  });
});

test('cancela só os lembretes do medicamento informado', async () => {
  await reagendarTodos([fixo('a', ['20:00']), fixo('b', ['21:00'])], AGORA);
  await cancelarLembretesMedicamento('a');

  const restantes = await Notifications.getAllScheduledNotificationsAsync();
  expect(restantes.length).toBeGreaterThan(0);
  expect(restantes.every((n) => n.identifier.startsWith('dose_b_'))).toBe(true);
});

test('reagendar respeita o limite total do iOS', async () => {
  const meds = [];
  for (let i = 0; i < 10; i++) meds.push(fixo(`m${i}`, ['06:00', '12:00', '18:00', '23:00']));

  const total = await reagendarTodos(meds, AGORA);
  expect(total).toBe(56);
});
