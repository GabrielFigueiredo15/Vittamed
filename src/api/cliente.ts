// Cliente HTTP da API do Vittamed (CONTRATO.md).
//
//  - Rotas protegidas recebem "Authorization: Bearer <id_token>".
//  - O id_token vale 1h: é renovado antes de vencer e, se a API ainda assim
//    responder 401, é renovado uma vez e a chamada é repetida.
//  - Se o refresh_token for recusado, a sessão acabou: avisa quem estiver
//    ouvindo (aoExpirarSessao) para o app voltar ao login.
//  - Sem internet o erro tem tipo 'sem_conexao'; o app continua com a cópia local.

import {
  limparSessao,
  renovarTokens,
  sessaoAtual,
  type SessaoResposta,
} from './sessao';

// Pode ser trocada por EXPO_PUBLIC_API_URL (ex.: backend local em testes manuais)
const URL_PADRAO = 'https://gate-mobile-vitamed.fastapicloud.dev';

// O Expo troca "process.env.EXPO_PUBLIC_API_URL" pelo valor na hora de montar
// o app: precisa ser escrito exatamente assim (sem "?."), senão não é trocado.
function urlDoAmbiente(): string | undefined {
  try {
    return process.env.EXPO_PUBLIC_API_URL || undefined;
  } catch {
    return undefined; // web (Vite) sem "process"
  }
}

let urlBase = (urlDoAmbiente() || URL_PADRAO).replace(/\/+$/, '');
let fetchImpl: typeof fetch | null = null;

export function definirUrlApi(url: string): void {
  urlBase = url.replace(/\/+$/, '');
}

// Para testes: troca o fetch usado (null volta ao fetch global)
export function definirFetch(f: typeof fetch | null): void {
  fetchImpl = f;
}

// Renova o token um pouco antes de vencer, para não falhar no meio de uma ação
const MARGEM_RENOVACAO_MS = 60 * 1000;

export type TipoErroApi =
  | 'sem_conexao'      // sem internet ou servidor fora do ar
  | 'nao_autorizado'   // 401: credenciais erradas ou sessão expirada
  | 'pausado'          // 503 com { pausado: true } (modo manutenção)
  | 'http';            // qualquer outro status de erro

export class ErroApi extends Error {
  constructor(
    public readonly tipo: TipoErroApi,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

export const ehErroApi = (e: unknown): e is ErroApi => e instanceof ErroApi;

type OuvinteExpirar = () => void;
const ouvintesExpirar = new Set<OuvinteExpirar>();

export function aoExpirarSessao(fn: OuvinteExpirar): () => void {
  ouvintesExpirar.add(fn);
  return () => {
    ouvintesExpirar.delete(fn);
  };
}

// FastAPI devolve { detail: "texto" } ou { detail: [{ msg }] } (422)
function mensagemDoCorpo(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const c = corpo as { detail?: unknown; mensagem?: unknown };
  if (typeof c.detail === 'string') return c.detail;
  if (Array.isArray(c.detail)) {
    const msgs = c.detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (typeof c.mensagem === 'string') return c.mensagem;
  return null;
}

interface Opcoes {
  corpo?: unknown;
  autenticado?: boolean;            // padrão: true
}

async function chamar(metodo: string, caminho: string, opcoes: Opcoes, token?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const f = fetchImpl ?? globalThis.fetch;
  try {
    return await f(`${urlBase}${caminho}`, {
      method: metodo,
      headers,
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });
  } catch (erro) {
    console.log(erro);
    throw new ErroApi('sem_conexao', 0, 'Sem conexão com o servidor.');
  }
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function erroDaResposta(resposta: Response): Promise<ErroApi> {
  const corpo = await lerCorpo(resposta);
  const mensagem = mensagemDoCorpo(corpo) ?? `A API respondeu com HTTP ${resposta.status}.`;

  if (resposta.status === 401) return new ErroApi('nao_autorizado', 401, mensagem);
  if (resposta.status === 503 && corpo && typeof corpo === 'object' && (corpo as { pausado?: unknown }).pausado) {
    return new ErroApi('pausado', 503, mensagem);
  }
  // 502/503/504 = servidor ou serviço externo fora do ar: trata como sem conexão
  if ([502, 503, 504].includes(resposta.status)) return new ErroApi('sem_conexao', resposta.status, mensagem);
  return new ErroApi('http', resposta.status, mensagem);
}

// Várias chamadas ao mesmo tempo com token vencido fazem um único refresh
let renovando: Promise<string> | null = null;

async function renovarToken(): Promise<string> {
  if (!renovando) {
    renovando = (async () => {
      const sessao = sessaoAtual();
      if (!sessao) throw new ErroApi('nao_autorizado', 401, 'Sessão encerrada. Entre de novo.');

      const resposta = await chamar('POST', '/auth/refresh', {
        corpo: { refresh_token: sessao.refreshToken },
        autenticado: false,
      });

      if (!resposta.ok) {
        const erro = await erroDaResposta(resposta);
        if (erro.tipo === 'nao_autorizado' || erro.status === 400) {
          await limparSessao();
          ouvintesExpirar.forEach((fn) => fn());
          throw new ErroApi('nao_autorizado', 401, 'Sua sessão expirou. Entre de novo.');
        }
        throw erro;
      }

      const nova = await renovarTokens((await lerCorpo(resposta)) as SessaoResposta);
      return nova.idToken;
    })().finally(() => {
      renovando = null;
    });
  }
  return renovando;
}

async function tokenValido(): Promise<string> {
  const sessao = sessaoAtual();
  if (!sessao) throw new ErroApi('nao_autorizado', 401, 'Entre na sua conta para continuar.');
  if (sessao.expiraEm - Date.now() > MARGEM_RENOVACAO_MS) return sessao.idToken;
  return renovarToken();
}

// Faz a chamada e devolve o JSON da resposta (null quando vazio, ex.: 204)
export async function requisitar<T>(metodo: string, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const autenticado = opcoes.autenticado ?? true;

  let token = autenticado ? await tokenValido() : undefined;
  let resposta = await chamar(metodo, caminho, opcoes, token);

  // Token recusado (ex.: relógio do aparelho errado): renova e tenta mais uma vez
  if (autenticado && resposta.status === 401) {
    token = await renovarToken();
    resposta = await chamar(metodo, caminho, opcoes, token);
  }

  if (!resposta.ok) throw await erroDaResposta(resposta);
  return (await lerCorpo(resposta)) as T;
}
