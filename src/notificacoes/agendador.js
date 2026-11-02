// Agenda e cancela os lembretes locais das doses (RF07).
// Os lembretes ficam no próprio aparelho: tocam mesmo com o app fechado.

import * as Notifications from 'expo-notifications';

import { proximosHorarios } from './agendamento';
import { textoLembreteDose } from './textos';
import { CANAL_DOSES, CATEGORIA_DOSE } from './constantes';

// O iOS aceita no máximo 64 pendentes; deixamos folga para adiados/orientações.
const LIMITE_TOTAL = 56;
const PREFIXO_DOSE = 'dose_';

// Identificador único e previsível: dose_<medicamentoId>_<timestamp>
function idLembrete(medicamentoId, horario) {
  return `${PREFIXO_DOSE}${medicamentoId}_${horario.getTime()}`;
}

// Agenda o lembrete de uma dose em um horário exato
export async function agendarLembreteDose(med, horario) {
  const texto = textoLembreteDose(med, horario);

  return Notifications.scheduleNotificationAsync({
    identifier: idLembrete(med.id, horario),
    content: {
      title: texto.titulo,
      body: texto.corpo,
      sound: 'default',
      categoryIdentifier: CATEGORIA_DOSE,
      data: {
        tipo: 'dose',
        medicamentoId: med.id,
        horarioPrevisto: horario.toISOString(),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: horario,
      channelId: CANAL_DOSES,
    },
  });
}

// Lista só os lembretes de dose (ignora orientações e outros)
export async function listarLembretesDose() {
  const todos = await Notifications.getAllScheduledNotificationsAsync();
  return todos.filter((n) => n.identifier.startsWith(PREFIXO_DOSE));
}

// Cancela os lembretes de um medicamento (ao editar, excluir ou encerrar)
export async function cancelarLembretesMedicamento(medicamentoId) {
  const prefixo = `${PREFIXO_DOSE}${medicamentoId}_`;
  const lembretes = await listarLembretesDose();

  for (const lembrete of lembretes) {
    if (lembrete.identifier.startsWith(prefixo)) {
      await Notifications.cancelScheduledNotificationAsync(lembrete.identifier);
    }
  }
}

// Cancela todos os lembretes de dose (ex.: usuário desativou ou fez logout)
export async function cancelarTodosLembretes() {
  const lembretes = await listarLembretesDose();

  for (const lembrete of lembretes) {
    await Notifications.cancelScheduledNotificationAsync(lembrete.identifier);
  }
}

// Apaga e recria os lembretes de todos os medicamentos.
// Chamar ao abrir o app e sempre que a lista de medicamentos mudar.
// Retorna quantos lembretes foram agendados.
export async function reagendarTodos(medicamentos, agora = new Date()) {
  await cancelarTodosLembretes();

  // Junta as próximas doses de todos os remédios e pega as mais próximas
  let doses = [];
  for (const med of medicamentos) {
    for (const horario of proximosHorarios(med, agora)) {
      doses.push({ med, horario });
    }
  }
  doses.sort((a, b) => a.horario - b.horario);
  doses = doses.slice(0, LIMITE_TOTAL);

  for (const dose of doses) {
    await agendarLembreteDose(dose.med, dose.horario);
  }
  return doses.length;
}

// Notificação de teste, toca em alguns segundos
export async function enviarNotificacaoTeste(segundos = 5) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Teste do Vittamed',
      body: 'Os lembretes estão funcionando neste aparelho.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: segundos,
      channelId: CANAL_DOSES,
    },
  });
}
