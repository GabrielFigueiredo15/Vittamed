// Gera os próximos horários de dose a partir do agendamento de um medicamento.
// Funções puras (sem React Native), fáceis de testar com jest.
//
// Convenções do contrato:
//  - horarios "HH:MM" são horários LOCAIS do aparelho.
//  - dias_semana: 0=seg .. 6=dom (no JS, getDay() usa 0=dom).
//  - periodo_inicio / periodo_fim: "YYYY-MM-DD" (inclusive).

import { TIPO_FIXO, TIPO_INTERVALO, TIPO_DIAS_SEMANA } from './constantes';
import type { Agendamento, Medicamento } from './tipos';

const HORARIO_PADRAO = '08:00';
const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;

// O iOS só guarda 64 notificações pendentes. Agendamos poucos dias
// e reagendamos sempre que o app abre ou um medicamento muda.
export const JANELA_PADRAO_DIAS = 3;
export const LIMITE_POR_MEDICAMENTO = 20;

// "08:30" -> { h: 8, m: 30 } | null
export function parseHorario(texto: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(texto).trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

// "2026-11-01" -> Date local à meia-noite | null
export function parseDataLocal(texto?: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto || '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// getDay() do JS (0=dom) -> padrão do contrato (0=seg)
export function diaSemanaContrato(data: Date): number {
  return (data.getDay() + 6) % 7;
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function comHorario(dia: Date, texto: string): Date | null {
  const hm = parseHorario(texto);
  if (!hm) return null;
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hm.h, hm.m);
}

function horariosValidos(agendamento: Agendamento): string[] {
  const lista = (agendamento.horarios || []).filter((h) => parseHorario(h) !== null);
  return lista.length > 0 ? [...lista].sort() : [HORARIO_PADRAO];
}

// Medicamento deve gerar lembretes? (ativo, com agendamento e dentro do período)
export function deveLembrar(med: Medicamento, agora: Date = new Date()): boolean {
  if (med.ativo === false) return false;
  if (!med.agendamento) return false;
  const fim = parseDataLocal(med.periodo_fim);
  if (fim && new Date(fim.getTime() + MS_DIA) <= agora) return false;
  return true;
}

// Próximos horários de dose (ordenados, sem repetição) dentro da janela.
export function proximosHorarios(
  med: Medicamento,
  agora: Date = new Date(),
  dias: number = JANELA_PADRAO_DIAS,
  limite: number = LIMITE_POR_MEDICAMENTO
): Date[] {
  if (!deveLembrar(med, agora) || !med.agendamento) return [];
  const ag = med.agendamento;

  let inicio = agora;
  let fim = new Date(agora.getTime() + dias * MS_DIA);

  const pInicio = parseDataLocal(med.periodo_inicio);
  if (pInicio && pInicio > inicio) inicio = pInicio;

  const pFim = parseDataLocal(med.periodo_fim);
  if (pFim) {
    const fimDoDia = new Date(pFim.getTime() + MS_DIA - 1);
    if (fimDoDia < fim) fim = fimDoDia;
  }
  if (inicio > fim) return [];

  const resultado: Date[] = [];
  const adicionar = (d: Date | null) => {
    if (d && d >= inicio && d <= fim && d > agora) resultado.push(d);
  };

  if (ag.tipo === TIPO_FIXO || ag.tipo === TIPO_DIAS_SEMANA) {
    const horarios = horariosValidos(ag);
    const diasPermitidos = ag.tipo === TIPO_DIAS_SEMANA ? ag.dias_semana || [] : null;

    for (let dia = inicioDoDia(inicio); dia <= fim; dia = new Date(dia.getTime() + MS_DIA)) {
      if (diasPermitidos && !diasPermitidos.includes(diaSemanaContrato(dia))) continue;
      horarios.forEach((h) => adicionar(comHorario(dia, h)));
    }
  } else if (ag.tipo === TIPO_INTERVALO) {
    const passoHoras = ag.intervalo_horas || 0;
    if (passoHoras <= 0) return [];
    const passo = passoHoras * MS_HORA;

    // Âncora: primeiro horário cadastrado no dia de início do tratamento
    // (ou da criação). Ex.: 08:00 a cada 8h -> 08, 16, 00...
    const diaAncora =
      pInicio || (med.criado_em ? inicioDoDia(new Date(med.criado_em)) : inicioDoDia(agora));
    const ancora = comHorario(diaAncora, horariosValidos(ag)[0]) as Date;

    const saltos = Math.max(0, Math.ceil((inicio.getTime() - ancora.getTime()) / passo));
    for (let t = ancora.getTime() + saltos * passo; t <= fim.getTime(); t += passo) {
      adicionar(new Date(t));
      if (resultado.length >= limite) break;
    }
  }

  const unicos = Array.from(new Set(resultado.map((d) => d.getTime())))
    .sort((a, b) => a - b)
    .slice(0, limite);
  return unicos.map((t) => new Date(t));
}
