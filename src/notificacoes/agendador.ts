// Agenda e cancela os lembretes (RF07 doses, RF08 adiadas, RF14 orientações).
// No Android os lembretes ficam no sistema (notificador.native.ts); na web, em memória (notificador.ts).

import {
  agendarNotificacao,
  listarAgendadas,
  cancelarNotificacao,
  type NotificacaoAgendada,
} from './notificador';
import { parseDataLocal, proximosHorarios } from './agendamento';
import {
  CANAL_DOSES,
  CANAL_DOSES_SOM,
  CANAL_DOSES_VIBRACAO,
  CANAL_DOSES_VISUAL,
} from './constantes';
import { textoDoseAdiada, textoLembreteDose, textoOrientacaoVencida } from './textos';
import type { DadosNotificacao, Medicamento, Orientacao } from './tipos';

// Limite de pendentes; deixa folga para adiados/orientações.
const LIMITE_TOTAL = 56;
const PREFIXO_DOSE = 'dose_';
const PREFIXO_ADIADA = 'adiada_';
const PREFIXO_ORIENTACAO = 'orientacao_';

// Orientações vencidas: lembrete às 9h, nos próximos dias (no máximo 8 avisos no total)
const HORA_ORIENTACAO = 9;
const DIAS_ORIENTACAO = 3;
const LIMITE_ORIENTACOES = 8;

export type FormatoLembrete = 'visual' | 'som' | 'vibracao';

const CANAL_POR_FORMATO: Record<FormatoLembrete, string> = {
  visual: CANAL_DOSES_VISUAL,
  som: CANAL_DOSES_SOM,
  vibracao: CANAL_DOSES_VIBRACAO,
};

let canalAtual: string = CANAL_DOSES;

// Define como os próximos lembretes avisam (só visual, som ou vibração)
export function definirFormatoLembrete(formato: FormatoLembrete): void {
  canalAtual = CANAL_POR_FORMATO[formato] ?? CANAL_DOSES;
}

// Identificador único e previsível: dose_<medicamentoId>_<timestamp>
function idLembrete(medicamentoId: string, horario: Date): string {
  return `${PREFIXO_DOSE}${medicamentoId}_${horario.getTime()}`;
}

function idAdiada(medicamentoId: string, horarioPrevisto: Date): string {
  return `${PREFIXO_ADIADA}${medicamentoId}_${horarioPrevisto.getTime()}`;
}

// Agenda o lembrete de uma dose em um horário exato
export async function agendarLembreteDose(med: Medicamento, horario: Date): Promise<string> {
  const texto = textoLembreteDose(med, horario);
  const dados: DadosNotificacao = {
    tipo: 'dose',
    medicamentoId: med.id,
    horarioPrevisto: horario.toISOString(),
  };

  return agendarNotificacao({
    identifier: idLembrete(med.id, horario),
    content: { title: texto.titulo, body: texto.corpo, data: dados },
    trigger: { date: horario },
    canal: canalAtual,
  });
}

// Novo lembrete quando a dose é adiada (RF08). Guarda o horário original da dose.
export async function agendarLembreteAdiado(
  med: Medicamento,
  horarioPrevisto: Date,
  novoHorario: Date
): Promise<string> {
  const texto = textoDoseAdiada(med, novoHorario);
  const dados: DadosNotificacao = {
    tipo: 'dose',
    medicamentoId: med.id,
    horarioPrevisto: horarioPrevisto.toISOString(),
  };

  return agendarNotificacao({
    identifier: idAdiada(med.id, horarioPrevisto),
    content: { title: texto.titulo, body: texto.corpo, data: dados },
    trigger: { date: novoHorario },
    canal: canalAtual,
  });
}

async function listarPorPrefixo(prefixo: string): Promise<NotificacaoAgendada[]> {
  return (await listarAgendadas()).filter((n) => n.identifier.startsWith(prefixo));
}

// Lista só os lembretes de dose
export async function listarLembretesDose(): Promise<NotificacaoAgendada[]> {
  return listarPorPrefixo(PREFIXO_DOSE);
}

// Cancela o lembrete de uma dose já registrada (tomada, não tomada ou adiada)
export async function cancelarLembreteDose(medicamentoId: string, horario: Date): Promise<void> {
  await cancelarNotificacao(idLembrete(medicamentoId, horario));
  await cancelarNotificacao(idAdiada(medicamentoId, horario));
}

// Cancela os lembretes de um medicamento (ao editar, excluir ou encerrar)
export async function cancelarLembretesMedicamento(medicamentoId: string): Promise<void> {
  for (const prefixo of [PREFIXO_DOSE, PREFIXO_ADIADA]) {
    for (const lembrete of await listarPorPrefixo(`${prefixo}${medicamentoId}_`)) {
      await cancelarNotificacao(lembrete.identifier);
    }
  }
}

// Cancela todos os lembretes de dose (os adiados continuam, pois não são recalculados)
export async function cancelarTodosLembretes(): Promise<void> {
  for (const lembrete of await listarLembretesDose()) {
    await cancelarNotificacao(lembrete.identifier);
  }
}

// Cancela os lembretes de doses adiadas
export async function cancelarLembretesAdiados(): Promise<void> {
  for (const lembrete of await listarPorPrefixo(PREFIXO_ADIADA)) {
    await cancelarNotificacao(lembrete.identifier);
  }
}

// Apaga e recria os lembretes de todos os medicamentos.
// Retorna quantos lembretes foram agendados.
export async function reagendarTodos(
  medicamentos: Medicamento[],
  agora: Date = new Date(),
  pular?: (med: Medicamento, horario: Date) => boolean // ex.: dose já registrada
): Promise<number> {
  await cancelarTodosLembretes();

  let doses: { med: Medicamento; horario: Date }[] = [];
  for (const med of medicamentos) {
    for (const horario of proximosHorarios(med, agora)) {
      if (pular?.(med, horario)) continue;
      doses.push({ med, horario });
    }
  }
  doses.sort((a, b) => a.horario.getTime() - b.horario.getTime());
  doses = doses.slice(0, LIMITE_TOTAL);

  for (const dose of doses) {
    await agendarLembreteDose(dose.med, dose.horario);
  }
  return doses.length;
}

// Cancela os lembretes de orientações
export async function cancelarLembretesOrientacao(): Promise<void> {
  for (const lembrete of await listarPorPrefixo(PREFIXO_ORIENTACAO)) {
    await cancelarNotificacao(lembrete.identifier);
  }
}

// Orientações vencidas e não concluídas ganham um lembrete diário às 9h (RF14).
// Concluir ou excluir a orientação e reagendar já remove o lembrete.
// Retorna quantos lembretes foram agendados.
export async function reagendarOrientacoes(
  orientacoes: Orientacao[],
  medicamentos: Medicamento[],
  agora: Date = new Date()
): Promise<number> {
  await cancelarLembretesOrientacao();

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let total = 0;

  for (const orientacao of orientacoes) {
    if (orientacao.concluida) continue;
    const validade = parseDataLocal(orientacao.validade);
    if (!validade) continue;

    // Vence no dia seguinte ao fim da validade
    const venceEm = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate() + 1);
    const primeiro = venceEm > hoje ? venceEm : hoje;
    const med = medicamentos.find((m) => m.id === orientacao.medicamento_id);
    const texto = textoOrientacaoVencida(orientacao, med);
    const dados: DadosNotificacao = {
      tipo: 'orientacao',
      orientacaoId: orientacao.id,
      medicamentoId: orientacao.medicamento_id,
    };

    let feitos = 0;
    // Até 3 avisos futuros por orientação (o de hoje às 9h já pode ter passado)
    for (let i = 0; i <= DIAS_ORIENTACAO && feitos < DIAS_ORIENTACAO && total < LIMITE_ORIENTACOES; i++) {
      const quando = new Date(
        primeiro.getFullYear(),
        primeiro.getMonth(),
        primeiro.getDate() + i,
        HORA_ORIENTACAO
      );
      if (quando <= agora) continue;
      await agendarNotificacao({
        identifier: `${PREFIXO_ORIENTACAO}${orientacao.id}_${quando.getTime()}`,
        content: { title: texto.titulo, body: texto.corpo, data: dados },
        trigger: { date: quando },
        canal: canalAtual,
      });
      total++;
      feitos++;
    }
  }
  return total;
}

// Notificação de teste, aparece em alguns segundos
export async function enviarNotificacaoTeste(segundos: number = 5): Promise<string> {
  return agendarNotificacao({
    identifier: `teste_${Date.now()}`,
    content: { title: 'Teste do Vittamed', body: 'Os lembretes estão funcionando.' },
    trigger: { seconds: segundos },
    canal: canalAtual,
  });
}
