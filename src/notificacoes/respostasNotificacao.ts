export interface RespostaNotificacao {
  actionIdentifier: string;
  identifier: string;
  titulo: string;
  corpo: string;
  dados: unknown;
}

export type ListenerRespostaNotificacao = (resposta: RespostaNotificacao) => void;

export async function registrarAcoesNotificacao(): Promise<void> {}

export function ouvirRespostasNotificacao(
  _listener: ListenerRespostaNotificacao
): () => void {
  return () => {};
}
