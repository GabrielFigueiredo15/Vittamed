// Testes de agendamento.ts — rodar com: npx jest src/notificacoes
import { proximosHorarios, deveLembrar, diaSemanaContrato } from './agendamento';
import type { Agendamento, Medicamento } from './tipos';

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Domingo, 01/11/2026, 10:00 (local)
const AGORA = new Date(2026, 10, 1, 10, 0);

const base: Medicamento = { id: 'm1', nome: 'Losartana', ativo: true };

describe('proximosHorarios', () => {
  test('fixo: pula horários que já passaram hoje', () => {
    const med = { ...base, agendamento: { tipo: 'fixo' as const, horarios: ['20:00', '08:00'] } };
    const r = proximosHorarios(med, AGORA, 2);
    expect(r.map(hhmm)).toEqual(['20:00', '08:00', '20:00', '08:00']);
    expect(r[0].getDate()).toBe(1);
  });

  test('dias_semana: só seg (0) e qua (2)', () => {
    const med = {
      ...base,
      agendamento: { tipo: 'dias_semana' as const, horarios: ['09:00'], dias_semana: [0, 2] },
    };
    const r = proximosHorarios(med, AGORA, 7);
    expect(r.map((d) => diaSemanaContrato(d))).toEqual([0, 2]);
    expect(r.map((d) => d.getDate())).toEqual([2, 4]);
  });

  test('intervalo: a cada 8h ancorado às 08:00 do início', () => {
    const med = {
      ...base,
      periodo_inicio: '2026-11-01',
      agendamento: { tipo: 'intervalo' as const, intervalo_horas: 8, horarios: ['08:00'] },
    };
    const r = proximosHorarios(med, AGORA, 1);
    expect(r.map(hhmm)).toEqual(['16:00', '00:00', '08:00']);
  });

  test('respeita periodo_fim', () => {
    const med = {
      ...base,
      periodo_fim: '2026-11-02',
      agendamento: { tipo: 'fixo' as const, horarios: ['08:00'] },
    };
    expect(proximosHorarios(med, AGORA, 7)).toHaveLength(1);
  });

  test('inativo ou vencido não gera lembretes', () => {
    const ag: Agendamento = { tipo: 'fixo', horarios: ['08:00'] };
    expect(proximosHorarios({ ...base, ativo: false, agendamento: ag }, AGORA)).toEqual([]);
    expect(deveLembrar({ ...base, periodo_fim: '2026-10-31', agendamento: ag }, AGORA)).toBe(false);
  });
});
