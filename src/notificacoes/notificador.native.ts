// Agendador de notificações no Android (expo-notifications).
// As notificações ficam no AlarmManager do sistema: disparam com o app fechado.
// Se o módulo nativo não existir (Expo Go), cai no agendador em memória.
import { Alert } from 'react-native';
import { CANAL_DOSES, CANAL_DOSES_VISUAL, CATEGORIA_DOSE } from './constantes';
import { obterNotificacoes } from './expoNotifications.native';
import * as memoria from './notificadorMemoria';
import type { PedidoNotificacao, NotificacaoAgendada, AoTocar } from './notificadorMemoria';
import type { DadosNotificacao } from './tipos';

export type { PedidoNotificacao, NotificacaoAgendada, AoTocar } from './notificadorMemoria';

type Exibidor = (n: NotificacaoAgendada) => void;

// Fallback (Expo Go): mostra o aviso num Alert, só com o app aberto
memoria.definirExibidor((n) =>
  Alert.alert(n.content.title, n.content.body, [
    { text: 'Depois', style: 'cancel' },
    { text: 'Abrir', onPress: () => memoria.dispararToque(n.content.data as DadosNotificacao) },
  ])
);

// Troca a forma de exibir o aviso no fallback em memória
export function definirExibidor(fn: Exibidor | null): void {
  memoria.definirExibidor(fn);
}

let ultimaResposta = '';

// Trata o toque na notificação (ou em um botão dela). Se o app foi aberto por
// uma notificação, o toque que o abriu também é entregue.
export function ouvirToque(fn: AoTocar): () => void {
  const desfazerMemoria = memoria.ouvirToque(fn);
  const N = obterNotificacoes();
  if (!N) return desfazerMemoria;

  const tratar = (resposta: import('expo-notifications').NotificationResponse): void => {
    const id = `${resposta.notification.request.identifier}:${resposta.actionIdentifier}`;
    if (id === ultimaResposta) return;
    ultimaResposta = id;
    const acao =
      resposta.actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER ? 'abrir' : resposta.actionIdentifier;
    fn(resposta.notification.request.content.data as unknown as DadosNotificacao, acao);
  };

  const assinatura = N.addNotificationResponseReceivedListener(tratar);
  const ultima = N.getLastNotificationResponse();
  if (ultima) tratar(ultima);

  return () => {
    assinatura.remove();
    desfazerMemoria();
  };
}

export async function agendarNotificacao(pedido: PedidoNotificacao): Promise<string> {
  const N = obterNotificacoes();
  if (!N) return memoria.agendarNotificacao(pedido);

  const canal = pedido.canal ?? CANAL_DOSES;
  const trigger: import('expo-notifications').NotificationTriggerInput =
    'date' in pedido.trigger
      ? {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: pedido.trigger.date,
          channelId: canal,
        }
      : {
          type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, pedido.trigger.seconds),
          channelId: canal,
        };

  const dados = (pedido.content.data ?? {}) as Record<string, unknown>;
  return N.scheduleNotificationAsync({
    identifier: pedido.identifier,
    content: {
      title: pedido.content.title,
      body: pedido.content.body,
      data: dados,
      sound: canal !== CANAL_DOSES_VISUAL,
      // Botões Tomei / Adiar / Não tomei só nos lembretes de dose
      categoryIdentifier: dados.tipo === 'dose' ? CATEGORIA_DOSE : undefined,
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
