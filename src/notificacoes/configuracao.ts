// Permissão de notificações do navegador (Notification API).
import type { ResultadoPermissao } from './tipos';

export function notificacoesSuportadas(): boolean {
  return typeof Notification !== 'undefined';
}

// Pede permissão ao navegador (precisa ser chamado a partir de um clique para funcionar bem)
export async function pedirPermissao(): Promise<ResultadoPermissao> {
  if (!notificacoesSuportadas()) return 'negada';
  if (Notification.permission === 'granted') return 'concedida';
  if (Notification.permission === 'denied') return 'negada';
  return (await Notification.requestPermission()) === 'granted' ? 'concedida' : 'negada';
}

// Roda uma vez na abertura da tela; só consulta, sem abrir o pedido do navegador
export async function inicializarNotificacoes(): Promise<ResultadoPermissao> {
  return notificacoesSuportadas() && Notification.permission === 'granted' ? 'concedida' : 'negada';
}
