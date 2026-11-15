// Tokens da sessão na API (CONTRATO.md, seção 1).
//
// Ficam em memória e numa cópia no aparelho (AsyncStorage / localStorage),
// para o app abrir já logado quando a pessoa marcou "Lembrar de mim".
// A senha nunca é guardada: só o id_token (vale 1h) e o refresh_token.

import { lerValor, salvarValor } from '../notificacoes/armazenamento';

const CHAVE_SESSAO = '@vittamed_sessao_api';

export interface SessaoApi {
  uid: string;
  email: string | null;
  idToken: string;
  refreshToken: string;
  expiraEm: number;                 // timestamp (ms) em que o id_token vence
}

// Resposta de /auth/registrar, /auth/login e /auth/refresh
export interface SessaoResposta {
  uid: string;
  email: string | null;
  id_token: string;
  refresh_token: string;
  expira_em: number;                // segundos
}

let atual: SessaoApi | null = null;

export function converterSessao(r: SessaoResposta, agora: number = Date.now()): SessaoApi {
  return {
    uid: r.uid,
    email: r.email,
    idToken: r.id_token,
    refreshToken: r.refresh_token,
    expiraEm: agora + r.expira_em * 1000,
  };
}

export function sessaoAtual(): SessaoApi | null {
  return atual;
}

export async function guardarSessao(sessao: SessaoApi | null): Promise<void> {
  atual = sessao;
  await salvarValor(CHAVE_SESSAO, sessao ? JSON.stringify(sessao) : '');
}

// O /auth/refresh devolve uid vazio e email null: mantém os que já tínhamos
export async function renovarTokens(r: SessaoResposta): Promise<SessaoApi> {
  const nova = converterSessao(r);
  const sessao: SessaoApi = {
    ...nova,
    uid: nova.uid || atual?.uid || '',
    email: nova.email ?? atual?.email ?? null,
  };
  await guardarSessao(sessao);
  return sessao;
}

// Lê a sessão salva no aparelho (chamar ao abrir o app)
export async function carregarSessao(): Promise<SessaoApi | null> {
  try {
    const bruto = await lerValor(CHAVE_SESSAO);
    const salvo = bruto ? (JSON.parse(bruto) as SessaoApi) : null;
    atual = salvo && salvo.idToken && salvo.refreshToken ? salvo : null;
  } catch (erro) {
    console.log(erro);
    atual = null;
  }
  return atual;
}

export async function limparSessao(): Promise<void> {
  await guardarSessao(null);
}
