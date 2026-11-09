// Testes de dose adiada, orientações vencidas e dose já registrada.
import type { Medicamento, Orientacao } from './tipos';
import { cancelarTodas, listarAgendadas } from './notificador';
import {
  agendarLembreteAdiado,
  cancelarLembreteDose,
  cancelarLembretesMedicamento,
  cancelarTodosLembretes,
  reagendarOrientacoes,
  reagendarTodos,
} from './agendador';

const AGORA = new Date(2026, 10, 1, 10, 0);
const med: Medicamento = {
  id: 'a', nome: 'Losartana', dosagem: '50mg', ativo: true,
  agendamento: { tipo: 'fixo', horarios: ['20:00'] },
};

beforeEach(() => cancelarTodas());
afterAll(() => cancelarTodas());

test('adiar agenda um novo lembrete que sobrevive ao reagendamento geral', async () => {
  const previsto = new Date(2026, 10, 1, 8, 0);
  const novo = new Date(2026, 10, 1, 8, 15);
  await agendarLembreteAdiado(med, previsto, novo);
  await cancelarTodosLembretes();

  const lista = listarAgendadas();
  expect(lista).toHaveLength(1);
  expect(lista[0].identifier).toBe(`adiada_a_${previsto.getTime()}`);
  expect(lista[0].quando).toEqual(novo);
});

test('cancelar a dose também cancela o adiamento dela', async () => {
  const previsto = new Date(2026, 10, 1, 8, 0);
  await agendarLembreteAdiado(med, previsto, new Date(2026, 10, 1, 8, 15));
  await cancelarLembreteDose('a', previsto);
  expect(listarAgendadas()).toHaveLength(0);
});

test('excluir o medicamento cancela doses e adiamentos', async () => {
  await reagendarTodos([med], AGORA);
  await agendarLembreteAdiado(med, new Date(2026, 10, 1, 8, 0), new Date(2026, 10, 1, 8, 15));
  await cancelarLembretesMedicamento('a');
  expect(listarAgendadas()).toHaveLength(0);
});

test('reagendar ignora doses já registradas', async () => {
  const total = await reagendarTodos([med], AGORA, (_m, h) => h.getDate() === 1);
  expect(total).toBe(2); // 2 e 3 de novembro; o dia 1 já foi registrado
});

const orientacao = (id: string, validade: string, concluida = false): Orientacao => ({
  id, medicamento_id: 'a', texto: 'Revisar com o farmacêutico', validade, concluida,
});

test('orientação vencida ganha lembrete diário às 9h', async () => {
  const total = await reagendarOrientacoes([orientacao('o1', '2026-10-31')], [med], AGORA);
  expect(total).toBe(3);
  const horas = listarAgendadas().map((n) => [n.quando.getDate(), n.quando.getHours()]);
  expect(horas).toEqual([[2, 9], [3, 9], [4, 9]]);
});

test('orientação concluída não agenda e reagendar remove a antiga', async () => {
  await reagendarOrientacoes([orientacao('o1', '2026-10-31')], [med], AGORA);
  const total = await reagendarOrientacoes([orientacao('o1', '2026-10-31', true)], [med], AGORA);
  expect(total).toBe(0);
  expect(listarAgendadas()).toHaveLength(0);
});

test('orientação ainda válida só avisa depois que vence', async () => {
  await reagendarOrientacoes([orientacao('o2', '2026-11-03')], [med], AGORA);
  expect(listarAgendadas()[0].quando).toEqual(new Date(2026, 10, 4, 9, 0));
});
