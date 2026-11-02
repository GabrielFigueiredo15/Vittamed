// Gera os próximos horários de dose a partir do Agendamento de um medicamento.
// Função pura (sem dependência de React Native) para ser fácil de testar.
//
// Convenções do contrato:
//  - horarios "HH:MM" são horários LOCAIS do aparelho.
//  - dias_semana: 0=seg .. 6=dom (diferente do JS, onde getDay() 0=dom).
//  - periodo_inicio / periodo_fim: "YYYY-MM-DD" (inclusive).

import type { Agendamento, Medicamento } from './tipos';

const HORARIO_PADRAO = '08:00';
const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;

// iOS só permite 64 notificações locais pendentes. Agendamos uma "janela"
// curta e reagendamos sempre que o app abre ou um medicamento muda.
export const JANELA_PADRAO_DIAS = 3;
export const LIMITE_POR_MEDICAMENTO = 20;

/** "08:30" -> { h: 8, m: 30 }; retorna null se inválido. */
export function parseHorario(hhmm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** "2026-11-01" -> Date local à meia-noite. */
export function parseDataLocal(yyyymmdd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyymmdd);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Converte getDay() do JS (0=dom) para o padrão do contrato (0=seg). */
export function diaSemanaContrato(data: Date): number {
  return (data.getDay() + 6) % 7;
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function comHorario(dia: Date, hhmm: string): Date | null {
  const hm = parseHorario(hhmm);
  if (!hm) return null;
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hm.h, hm.m);
}

function horariosValidos(ag: Agendamento): string[] {
  const lista = (ag.horarios ?? []).filter((h) => parseHorario(h) !== null);
  return lista.length > 0 ? [...lista].sort() : [HORARIO_PADRAO];
}

/** Limites efetivos: [max(agora, periodo_inicio), min(fimJanela, fim do periodo_fim)]. */
function limites(med: Medicamento, agora: Date, dias: number) {
  let inicio = agora;
  let fim = new Date(agora.getTime() + dias * MS_DIA);

  const pIni = med.periodo_inicio ? parseDataLocal(med.periodo_inicio) : null;
  if (pIni && pIni > inicio) inicio = pIni;

  const pFim = med.periodo_fim ? parseDataLocal(med.periodo_fim) : null;
  if (pFim) {
    const fimDoDia = new Date(pFim.getTime() + MS_DIA - 1); // 23:59:59.999
    if (fimDoDia < fim) fim = fimDoDia;
  }
  return { inicio, fim };
}

/** Indica se o medicamento deve gerar lembretes (ativo e período não encerrado). */
export function deveLembrar(med: Medicamento, agora: Date = new Date()): boolean {
  if (med.ativo === false) return false;
  if (!med.agendamento) return false;
  const pFim = med.periodo_fim ? parseDataLocal(med.periodo_fim) : null;
  if (pFim && new Date(pFim.getTime() + MS_DIA) <= agora) return false;
  return true;
}

/**
 * Próximos horários de dose (ordenados, sem repetição) dentro da janela.
 * Retorna [] se o medicamento não deve gerar lembretes.
 */
export function proximosHorarios(
  med: Medicamento,
  agora: Date = new Date(),
  dias: number = JANELA_PADRAO_DIAS,
  limite: number = LIMITE_POR_MEDICAMENTO,
): Date[] {
  if (!deveLembrar(med, agora)) return [];
  const ag = med.agendamento!;
  const { inicio, fim } = limites(med, agora, dias);
  if (inicio > fim) return [];

  const resultado: Date[] = [];
  const adicionar = (d: Date | null) => {
    if (d && d >= inicio && d <= fim && d > agora) resultado.push(d);
  };

  if (ag.tipo === 'fixo' || ag.tipo === 'dias_semana') {
    const horarios = horariosValidos(ag);
    const diasPermitidos =
      ag.tipo === 'dias_semana' ? new Set(ag.dias_semana ?? []) : null;

    for (let dia = inicioDoDia(inicio); dia <= fim; dia = new Date(dia.getTime() + MS_DIA)) {
      if (diasPermitidos && !diasPermitidos.has(diaSemanaContrato(dia))) continue;
      for (const h of horarios) adicionar(comHorario(dia, h));
    }
  } else if (ag.tipo === 'intervalo') {
    const passoH = ag.intervalo_horas ?? 0;
    if (passoH <= 0) return [];
    const passo = passoH * MS_HORA;

    // Âncora: primeiro horário cadastrado no dia de início do tratamento
    // (ou da criação do medicamento). Ex.: 08:00 a cada 8h -> 08, 16, 00...
    const diaAncora =
      (med.periodo_inicio && parseDataLocal(med.periodo_inicio)) ||
      (med.criado_em ? inicioDoDia(new Date(med.criado_em)) : inicioDoDia(agora));
    const ancora = comHorario(diaAncora, horariosValidos(ag)[0])!;

    // Pula direto para o primeiro múltiplo do passo >= inicio.
    const saltos = Math.max(0, Math.ceil((inicio.getTime() - ancora.getTime()) / passo));
    for (let t = ancora.getTime() + saltos * passo; t <= fim.getTime(); t += passo) {
      adicionar(new Date(t));
      if (resultado.length >= limite) break;
    }
  }

  // Ordena, remove duplicados e aplica o limite.
  const unicos = Array.from(new Set(resultado.map((d) => d.getTime())))
    .sort((a, b) => a - b)
    .slice(0, limite);
  return unicos.map((t) => new Date(t));
}
