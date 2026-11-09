// Agendador local de notificações (roda só com a página aberta).
// Usa setTimeout e mostra o aviso pela Notification API do navegador (ou no console).

import type { DadosNotificacao } from './tipos';

export interface PedidoNotificacao {
  identifier: string;
  content: { title: string; body: string; data?: unknown };
  trigger: { date: Date } | { seconds: number };
  canal?: string; // canal do Android (formato do lembrete); ignorado na web
}

// Chamado quando o usuário toca na notificação ou em um dos botões dela
export type AoTocar = (dados: DadosNotificacao | undefined, acao: string) => void;

export interface NotificacaoAgendada extends PedidoNotificacao {
  quando: Date;
}

type Exibidor = (n: NotificacaoAgendada) => void;

const agendadas = new Map<string, { n: NotificacaoAgendada; timer: ReturnType<typeof setTimeout> }>();

let aoTocar: AoTocar | null = null;

// Registra quem trata o toque na notificação; devolve a função que remove o registro
export function ouvirToque(fn: AoTocar): () => void {
  aoTocar = fn;
  return () => {
    if (aoTocar === fn) aoTocar = null;
  };
}

export function dispararToque(dados: DadosNotificacao | undefined, acao: string = 'abrir'): void {
  aoTocar?.(dados, acao);
}

const exibidorPadrao: Exibidor = (n) => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const aviso = new Notification(n.content.title, { body: n.content.body });
    aviso.onclick = () => {
      try {
        window.focus();
      } catch {
        // sem janela para focar
      }
      dispararToque(n.content.data as DadosNotificacao | undefined);
      aviso.close();
    };
  } else {
    console.log(`🔔 ${n.content.title} — ${n.content.body}`);
  }
};
let exibir: Exibidor = exibidorPadrao;

// Troca a forma de exibir o aviso (útil em testes ou para integrar outro canal)
export function definirExibidor(fn: Exibidor | null): void {
  exibir = fn ?? exibidorPadrao;
}

export function agendarNotificacao(pedido: PedidoNotificacao): string {
  const quando =
    'date' in pedido.trigger
      ? pedido.trigger.date
      : new Date(Date.now() + pedido.trigger.seconds * 1000);
  const n: NotificacaoAgendada = { ...pedido, quando };

  cancelarNotificacao(pedido.identifier);

  // setTimeout aceita no máximo ~24,8 dias; as janelas de agendamento são bem menores
  const espera = Math.min(Math.max(quando.getTime() - Date.now(), 0), 2 ** 31 - 1);
  const timer = setTimeout(() => {
    agendadas.delete(pedido.identifier);
    exibir(n);
  }, espera);
  (timer as { unref?: () => void }).unref?.(); // Node: não segura o processo aberto

  agendadas.set(pedido.identifier, { n, timer });
  return pedido.identifier;
}

export function listarAgendadas(): NotificacaoAgendada[] {
  return [...agendadas.values()].map((a) => a.n);
}

export function cancelarNotificacao(identifier: string): void {
  const atual = agendadas.get(identifier);
  if (atual) clearTimeout(atual.timer);
  agendadas.delete(identifier);
}

export function cancelarTodas(): void {
  for (const id of [...agendadas.keys()]) cancelarNotificacao(id);
}
