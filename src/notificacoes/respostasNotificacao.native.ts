import { ACAO_ADIAR, ACAO_NAO_TOMEI, ACAO_TOMEI, CATEGORIA_DOSE } from './constantes';
import { obterNotificacoes } from './expoNotifications.native';
import type { ListenerRespostaNotificacao, RespostaNotificacao } from './respostasNotificacao';
import type { NotificationResponse } from 'expo-notifications';

function converterResposta(resposta: NotificationResponse): RespostaNotificacao {
  const conteudo = resposta.notification.request.content;
  return {
    actionIdentifier: resposta.actionIdentifier,
    identifier: resposta.notification.request.identifier,
    titulo: conteudo.title ?? '',
    corpo: conteudo.body ?? '',
    dados: conteudo.data,
  };
}

function chaveResposta(resposta: NotificationResponse): string {
  return [
    resposta.notification.request.identifier,
    resposta.actionIdentifier,
    resposta.notification.date,
  ].join(':');
}

export async function registrarAcoesNotificacao(): Promise<void> {
  const notificacoes = obterNotificacoes();
  if (!notificacoes) return;

  await notificacoes.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_TOMEI, buttonTitle: 'Tomei', options: { opensAppToForeground: true } },
    { identifier: ACAO_ADIAR, buttonTitle: 'Adiar', options: { opensAppToForeground: true } },
    { identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei', options: { opensAppToForeground: true } },
  ]);
}

export function ouvirRespostasNotificacao(
  listener: ListenerRespostaNotificacao
): () => void {
  const notificacoes = obterNotificacoes();
  if (!notificacoes) return () => {};

  let ativo = true;
  const processadas = new Set<string>();
  const despachar = (resposta: NotificationResponse): void => {
    const chave = chaveResposta(resposta);
    if (!ativo || processadas.has(chave)) return;
    processadas.add(chave);
    listener(converterResposta(resposta));
  };

  const subscription = notificacoes.addNotificationResponseReceivedListener(despachar);
  void notificacoes.getLastNotificationResponseAsync()
    .then(async (resposta) => {
      if (!resposta || !ativo) return;
      despachar(resposta);
      await notificacoes.clearLastNotificationResponseAsync();
    })
    .catch((error: unknown) => {
      console.error('Não foi possível recuperar a resposta da última notificação.', error);
    });

  return () => {
    ativo = false;
    subscription.remove();
  };
}
