// Agenda e cancela os lembretes das doses (RF07).
// Os lembretes ficam em memória no processo Node (veja notificador.ts).

import {
  agendarNotificacao,
  listarAgendadas,
  cancelarNotificacao,
  type NotificacaoAgendada,
} from './notificador';
import { proximosHorarios } from './agendamento';
import { textoLembreteDose } from './textos';
import type { DadosNotificacao, Medicamento } from './tipos';

// Limite de pendentes; deixa folga para adiados/orientações.
const LIMITE_TOTAL = 56;
const PREFIXO_DOSE = 'dose_';

// Identificador único e previsível: dose_<medicamentoId>_<timestamp>
function idLembrete(medicamentoId: string, horario: Date): string {
  return `${PREFIXO_DOSE}${medicamentoId}_${horario.getTime()}`;
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
  });
}

// Lista só os lembretes de dose
export async function listarLembretesDose(): Promise<NotificacaoAgendada[]> {
  return listarAgendadas().filter((n) => n.identifier.startsWith(PREFIXO_DOSE));
}

// Cancela os lembretes de um medicamento (ao editar, excluir ou encerrar)
export async function cancelarLembretesMedicamento(medicamentoId: string): Promise<void> {
  const prefixo = `${PREFIXO_DOSE}${medicamentoId}_`;
  for (const lembrete of await listarLembretesDose()) {
    if (lembrete.identifier.startsWith(prefixo)) cancelarNotificacao(lembrete.identifier);
  }
}

// Cancela todos os lembretes de dose
export async function cancelarTodosLembretes(): Promise<void> {
  for (const lembrete of await listarLembretesDose()) {
    cancelarNotificacao(lembrete.identifier);
  }
}

// Apaga e recria os lembretes de todos os medicamentos.
// Retorna quantos lembretes foram agendados.
export async function reagendarTodos(
  medicamentos: Medicamento[],
  agora: Date = new Date()
): Promise<number> {
  await cancelarTodosLembretes();

  let doses: { med: Medicamento; horario: Date }[] = [];
  for (const med of medicamentos) {
    for (const horario of proximosHorarios(med, agora)) {
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

// Notificação de teste, aparece em alguns segundos
export async function enviarNotificacaoTeste(segundos: number = 5): Promise<string> {
  return agendarNotificacao({
    identifier: `teste_${Date.now()}`,
    content: { title: 'Teste do Vittamed', body: 'Os lembretes estão funcionando.' },
    trigger: { seconds: segundos },
  });
}
