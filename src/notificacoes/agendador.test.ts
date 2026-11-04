// Testes de agendador.ts. Rodar com: npm test
import type { Medicamento } from './tipos';
import { cancelarTodas, listarAgendadas } from './notificador';
import {
  agendarLembreteDose,
  cancelarLembretesMedicamento,
  reagendarTodos
} from './agendador';

const AGORA = new Date(2026, 10, 1, 10, 0);
const fixo = (id: string, horarios: string[]): Medicamento => ({
  id, nome: `Remédio ${id}`, ativo: true, agendamento: { tipo: 'fixo', horarios }
});

beforeEach(() => cancelarTodas());
afterAll(() => cancelarTodas());

test('agenda com data e dados para abrir a dose', async () => {
  const horario = new Date(2026, 10, 1, 20, 0);
  await agendarLembreteDose(fixo('a', ['20:00']), horario);

  const [req] = listarAgendadas();
  expect(req.identifier).toBe(`dose_a_${horario.getTime()}`);
  expect(req.quando).toEqual(horario);
  expect(req.content.data).toEqual({
    tipo: 'dose', medicamentoId: 'a', horarioPrevisto: horario.toISOString()
  });
});

test('cancela só os lembretes do medicamento informado', async () => {
  await reagendarTodos([fixo('a', ['20:00']), fixo('b', ['21:00'])], AGORA);
  await cancelarLembretesMedicamento('a');

  const restantes = listarAgendadas();
  expect(restantes.length).toBeGreaterThan(0);
  expect(restantes.every((n) => n.identifier.startsWith('dose_b_'))).toBe(true);
});

test('reagendar respeita o limite total', async () => {
  const meds: Medicamento[] = [];
  for (let i = 0; i < 10; i++) meds.push(fixo(`m${i}`, ['06:00', '12:00', '18:00', '23:00']));

  const total = await reagendarTodos(meds, AGORA);
  expect(total).toBe(56);
});
