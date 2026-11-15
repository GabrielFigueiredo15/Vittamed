// Web e testes: não há push remoto (veja push.native.ts para Android/iOS).

export type MotivoSemToken =
  | 'sem_suporte'
  | 'expo_go'
  | 'emulador'
  | 'sem_permissao'
  | 'sem_projeto'
  | 'erro';

export type ResultadoToken =
  | { ok: true; token: string; plataforma: 'android' | 'ios' }
  | { ok: false; motivo: MotivoSemToken; detalhe?: string };

export async function obterTokenPush(): Promise<ResultadoToken> {
  return { ok: false, motivo: 'sem_suporte' };
}

export function ouvirTrocaToken(_aoTrocar: () => void): () => void {
  return () => {};
}
