// Testes de agendador.ts com expo-notifications simulado.
// Rodar com: npx jest src/notificacoes
import * as Notifications from 'expo-notifications';
import type { Medicamento } from './tipos';

import {
  agendarLembreteDose,
  cancelarLembretesMedicamento,
  reagendarTodos
} from './agendador';

jest.mock('expo-notifications', () => {
  let agendadas: any[] = [];
  return {
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    scheduleNotificationAsync: jest.fn(async (req: any) => {
      agendadas.push(req);
      return req.identifier;
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => agendadas),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      agendadas = agendadas.filter((n) => n.identifier !== id);
    }),
    __limpar: () => { agendadas = []; }
  };
});

const AGORA = new Date(2026, 10, 1, 10, 0);
const fixo = (id: string, horarios: string[]): Medicamento => ({
  id, nome: `Remédio ${id}`, ativo: true, agendamento: { tipo: 'fixo', horarios }
});

// Função extra do mock para zerar a lista entre os testes
const limpar = (Notifications as unknown as { __limpar: () => void }).__limpar;
beforeEach(() => limpar());

test('agenda com data, canal e dados para abrir a dose', async () => {
  const horario = new Date(2026, 10, 1, 20, 0);
  await agendarLembreteDose(fixo('a', ['20:00']), horario);

  const [req] = (await Notifications.getAllScheduledNotificationsAsync()) as any[];
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
  const meds: Medicamento[] = [];
  for (let i = 0; i < 10; i++) meds.push(fixo(`m${i}`, ['06:00', '12:00', '18:00', '23:00']));

  const total = await reagendarTodos(meds, AGORA);
  expect(total).toBe(56);
});
