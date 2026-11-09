// Testes das funções puras do app: datas, doses do dia e assistente.
import type { Medicamento } from '../notificacoes/tipos';
import { responderAssistente } from './assistente';
import {
  brParaChave,
  calcularIdade,
  gradeDoMes,
  mascaraCelular,
  mascaraData,
  mascaraHora,
  semanaDe,
} from './datas';
import { dosesDoDia, letrasDoDia, proximaDose, type Registro } from './doses';

const AGORA = new Date(2026, 9, 12, 10, 0); // 12/10/2026 (segunda)
const med = (id: string, nome: string, horarios: string[], extra: Partial<Medicamento> = {}): Medicamento => ({
  id, nome, dosagem: '50 mg', ativo: true, periodo_inicio: '2026-10-01',
  agendamento: { tipo: 'fixo', horarios }, ...extra,
});
const registro = (m: string, h: Date, status: Registro['status']): Registro => ({
  id: `r${h.getTime()}`, medicamento_id: m, horario_previsto: h.toISOString(), status,
});

test('máscaras de data, hora e celular', () => {
  expect(mascaraData('05031954')).toBe('05/03/1954');
  expect(mascaraHora('0830')).toBe('08:30');
  expect(mascaraCelular('11999991234')).toBe('(11) 99999-1234');
});

test('data dd/mm/aaaa válida e inválida', () => {
  expect(brParaChave('05/03/1954')).toBe('1954-03-05');
  expect(brParaChave('31/02/2026')).toBeNull();
  expect(brParaChave('5/3/54')).toBeNull();
});

test('idade considera o aniversário', () => {
  expect(calcularIdade('1954-03-05', new Date(2026, 9, 12))).toBe(72);
  expect(calcularIdade('1954-11-05', new Date(2026, 9, 12))).toBe(71);
});

test('semana começa na segunda e o mês tem semanas completas', () => {
  const semana = semanaDe(AGORA);
  expect(semana[0].getDate()).toBe(12);
  expect(semana[6].getDate()).toBe(18);
  const grade = gradeDoMes(2026, 9); // outubro/2026 começa numa quinta
  expect(grade[0].slice(0, 3)).toEqual([null, null, null]);
  expect(grade[0][3]?.getDate()).toBe(1);
  expect(grade.every((s) => s.length === 7)).toBe(true);
});

test('doses do dia em ordem, com o status registrado', () => {
  const meds = [med('a', 'Losartana', ['08:00']), med('b', 'Metformina', ['12:00', '20:00'])];
  const oito = new Date(2026, 9, 12, 8, 0);
  const doses = dosesDoDia(meds, [registro('a', oito, 'tomada')], AGORA);
  expect(doses.map((d) => `${d.med.id}${d.horario.getHours()}`)).toEqual(['a8', 'b12', 'b20']);
  expect(doses.map((d) => d.status)).toEqual(['tomada', 'pendente', 'pendente']);
});

test('não gera doses antes do início nem depois do fim do período', () => {
  const m = med('a', 'Losartana', ['08:00'], { periodo_inicio: '2026-10-05', periodo_fim: '2026-10-10' });
  expect(dosesDoDia([m], [], new Date(2026, 9, 4))).toHaveLength(0);
  expect(dosesDoDia([m], [], new Date(2026, 9, 10))).toHaveLength(1);
  expect(dosesDoDia([m], [], new Date(2026, 9, 11))).toHaveLength(0);
});

test('dias específicos só geram dose nos dias escolhidos', () => {
  const m = med('a', 'Vitamina D', ['20:00'], { agendamento: { tipo: 'dias_semana', horarios: ['20:00'], dias_semana: [0, 2] } });
  expect(dosesDoDia([m], [], new Date(2026, 9, 12))).toHaveLength(1); // segunda
  expect(dosesDoDia([m], [], new Date(2026, 9, 13))).toHaveLength(0); // terça
  expect(dosesDoDia([m], [], new Date(2026, 9, 14))).toHaveLength(1); // quarta
});

test('próxima dose ignora as já registradas', () => {
  const meds = [med('a', 'Losartana', ['12:00', '20:00'])];
  const meio = new Date(2026, 9, 12, 12, 0);
  expect(proximaDose(meds, [], AGORA)?.horario).toEqual(meio);
  expect(proximaDose(meds, [registro('a', meio, 'tomada')], AGORA)?.horario.getHours()).toBe(20);
});

test('letras do calendário seguem a ordem T, N, A', () => {
  const dia = new Date(2026, 9, 11);
  const rs = [
    registro('a', new Date(2026, 9, 11, 20, 0), 'nao_tomada'),
    registro('a', new Date(2026, 9, 11, 8, 0), 'tomada'),
    registro('a', new Date(2026, 9, 11, 12, 0), 'adiada'),
  ];
  expect(letrasDoDia(rs, dia)).toEqual(['T', 'N', 'A']);
});

test('assistente lista remédios, informa a próxima dose e recusa dúvida clínica', () => {
  const meds = [med('a', 'Losartana', ['12:00'])];
  expect(responderAssistente('Quais remédios tenho cadastrados?', meds, [], AGORA)).toContain('Losartana 50 mg');
  expect(responderAssistente('Qual é a próxima dose?', meds, [], AGORA)).toContain('12:00');
  expect(responderAssistente('Posso tomar com álcool?', meds, [], AGORA)).toContain('médico ou farmacêutico');
});
