// Doses de um dia: junta os horários do agendamento com os registros feitos pelo usuário.
// Funções puras, sem React.

import { proximosHorarios } from '../notificacoes/agendamento';
import { formatarHora } from '../notificacoes/textos';
import type { Medicamento, Orientacao, StatusDose } from '../notificacoes/tipos';
import { chaveData, inicioDoDia, mesmoDia } from './datas';

export interface Registro {
  id: string;
  medicamento_id: string;
  horario_previsto: string;          // ISO 8601
  status: StatusDose;
  horario_registrado?: string | null;
  novo_horario?: string | null;
}

export interface DoseDia {
  med: Medicamento;
  horario: Date;
  registro?: Registro;
  status: StatusDose;                // 'pendente' = sem registro
}

export const chaveDose = (medicamentoId: string, horario: Date | string): string =>
  `${medicamentoId}|${new Date(horario).getTime()}`;

// Horários do medicamento em um dia (do passado ou do futuro)
export function horariosDoDia(med: Medicamento, dia: Date): Date[] {
  const antes = new Date(inicioDoDia(dia).getTime() - 1);
  return proximosHorarios(med, antes, 1, 60).filter((h) => mesmoDia(h, dia));
}

// Todas as doses do dia, em ordem de horário, já com o status registrado
export function dosesDoDia(meds: Medicamento[], registros: Registro[], dia: Date): DoseDia[] {
  const porChave = new Map(registros.map((r) => [chaveDose(r.medicamento_id, r.horario_previsto), r]));
  const doses: DoseDia[] = [];
  for (const med of meds) {
    for (const horario of horariosDoDia(med, dia)) {
      const registro = porChave.get(chaveDose(med.id, horario));
      doses.push({ med, horario, registro, status: registro?.status ?? 'pendente' });
    }
  }
  return doses.sort((a, b) => a.horario.getTime() - b.horario.getTime());
}

// Próxima dose ainda sem registro, a partir de agora (hoje ou nos próximos dias)
export function proximaDose(
  meds: Medicamento[],
  registros: Registro[],
  agora: Date = new Date()
): DoseDia | null {
  for (let i = 0; i < 8; i++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    const achada = dosesDoDia(meds, registros, dia).find(
      (d) => d.status === 'pendente' && d.horario > agora
    );
    if (achada) return achada;
  }
  return null;
}

// Letra usada no calendário e no histórico
export function letraStatus(status: StatusDose): string {
  if (status === 'tomada') return 'T';
  if (status === 'nao_tomada') return 'N';
  if (status === 'adiada') return 'A';
  return '';
}

export function textoStatus(status: StatusDose): string {
  if (status === 'tomada') return 'Tomada';
  if (status === 'nao_tomada') return 'Não tomada';
  if (status === 'adiada') return 'Adiada';
  return 'Sem registro';
}

// Letras (T, N, A) com registro em um dia, para a marca do calendário
export function letrasDoDia(registros: Registro[], dia: Date): string[] {
  const letras = new Set<string>();
  for (const r of registros) {
    if (mesmoDia(new Date(r.horario_previsto), dia)) letras.add(letraStatus(r.status));
  }
  return ['T', 'N', 'A'].filter((l) => letras.has(l));
}

export function orientacaoVencida(o: Orientacao, hoje: Date = new Date()): boolean {
  return !o.concluida && !!o.validade && o.validade < chaveData(hoje);
}

export function medicamentoFinalizado(med: Medicamento, hoje: Date = new Date()): boolean {
  return !!med.periodo_fim && med.periodo_fim < chaveData(hoje);
}

// "08:00 e 20:00" / "a cada 8 horas" / "Seg, Qua"
export function resumoHorarios(med: Medicamento): string {
  const ag = med.agendamento;
  if (!ag) return 'Sem horário';
  if (ag.tipo === 'intervalo') {
    return `A cada ${ag.intervalo_horas} h, a partir de ${(ag.horarios ?? ['08:00'])[0]}`;
  }
  return (ag.horarios ?? []).join(' · ') || '08:00';
}

export function resumoDias(med: Medicamento): string {
  const ag = med.agendamento;
  if (ag?.tipo === 'dias_semana') {
    const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    return (ag.dias_semana ?? []).map((d) => nomes[d]).join(', ');
  }
  return 'Todos os dias';
}

export { formatarHora };
