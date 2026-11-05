// Agendador de notificações no Android (expo-notifications).
// As notificações ficam no AlarmManager do sistema: disparam com o app fechado.
// Se o módulo nativo não existir (Expo Go), cai no agendador em memória.
import { Alert } from 'react-native';
import { CANAL_DOSES } from './constantes';
import { obterNotificacoes } from './expoNotifications.native';
import * as memoria from './notificadorMemoria';
import type { PedidoNotificacao, NotificacaoAgendada } from './notificadorMemoria';

export type { PedidoNotificacao, NotificacaoAgendada } from './notificadorMemoria';

type Exibidor = (n: NotificacaoAgendada) => void;

// Fallback (Expo Go): mostra o aviso num Alert, só com o app aberto
memoria.definirExibidor((n) => Alert.alert(n.content.title, n.content.body));

// Troca a forma de exibir o aviso no fallback em memória
export function definirExibidor(fn: Exibidor | null): void {
  memoria.definirExibidor(fn);
}

export async function agendarNotificacao(pedido: PedidoNotificacao): Promise<string> {
  const N = obterNotificacoes();
  if (!N) return memoria.agendarNotificacao(pedido);

  const trigger: import('expo-notifications').NotificationTriggerInput =
    'date' in pedido.trigger
      ? {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: pedido.trigger.date,
          channelId: CANAL_DOSES,
        }
      : {
          type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, pedido.trigger.seconds),
          channelId: CANAL_DOSES,
        };

  return N.scheduleNotificationAsync({
    identifier: pedido.identifier,
    content: {
      title: pedido.content.title,
      body: pedido.content.body,
      data: (pedido.content.data ?? {}) as Record<string, unknown>,
      sound: true,
    },
    trigger,
  });
}

export async function listarAgendadas(): Promise<NotificacaoAgendada[]> {
  const N = obterNotificacoes();
  if (!N) return memoria.listarAgendadas();

  const lista = await N.getAllScheduledNotificationsAsync();
  return lista.map((n) => {
    const t = n.trigger as { value?: number } | null;
    const quando = t?.value ? new Date(t.value) : new Date();
    return {
      identifier: n.identifier,
      content: {
        title: n.content.title ?? '',
        body: n.content.body ?? '',
        data: n.content.data,
      },
      trigger: { date: quando },
      quando,
    };
  });
}

export async function cancelarNotificacao(identifier: string): Promise<void> {
  const N = obterNotificacoes();
  if (!N) return memoria.cancelarNotificacao(identifier);
  await N.cancelScheduledNotificationAsync(identifier);
}

export async function cancelarTodas(): Promise<void> {
  const N = obterNotificacoes();
  if (!N) return memoria.cancelarTodas();
  await N.cancelAllScheduledNotificationsAsync();
}
