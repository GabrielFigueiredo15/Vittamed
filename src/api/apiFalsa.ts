// API falsa em memória, usada só nos testes (jest).
// Imita as rotas /auth/* e /perfil do CONTRATO.md, com os mesmos códigos HTTP
// e mensagens de erro do backend (Gate_Mobile_Vitamed/auth_fb.py).
//
// Uso:
//   const api = criarApiFalsa();
//   definirFetch(api.fetch);

interface Conta {
  uid: string;
  senha: string;
}

export interface ApiFalsa {
  fetch: typeof fetch;
  contas: Map<string, Conta>;                       // e-mail -> conta
  perfis: Map<string, Record<string, unknown>>;     // uid -> perfil
  chamadas: { metodo: string; caminho: string; corpo: unknown; token: string | null }[];
  offline: boolean;                                 // true: toda chamada falha como sem rede
  pausado: boolean;                                 // true: modo manutenção (503)
  // Endpoint proposto /aparelhos (RF09). false = backend ainda sem ele (404)
  comAparelhos: boolean;
  aparelhos: Map<string, { uid: string; plataforma: string }>; // token -> dono
  invalidarTokens(): void;                          // id_tokens atuais passam a dar 401
  invalidarRefresh(): void;                         // refresh_tokens atuais passam a dar 401
  criarConta(email: string, senha: string, perfil?: Record<string, unknown>): string;
  // Documentos de uma conta: colecao(uid, 'medicamentos' | 'doses' | 'orientacoes') -> id -> documento
  colecao(uid: string, nome: 'medicamentos' | 'doses' | 'orientacoes'): Map<string, Record<string, any>>;
}

export function criarApiFalsa(): ApiFalsa {
  const contas = new Map<string, Conta>();
  const perfis = new Map<string, Record<string, unknown>>();
  const idTokens = new Map<string, string>();       // token -> uid
  const refreshTokens = new Map<string, string>();  // token -> uid
  const chamadas: ApiFalsa['chamadas'] = [];
  const colecoes = new Map<string, Map<string, Record<string, any>>>();
  let contador = 0;

  const resposta = (status: number, corpo?: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)),
    }) as Response;

  const sessao = (uid: string, email: string | null) => {
    contador++;
    const id = `id_${uid}_${contador}`;
    const refresh = `refresh_${uid}_${contador}`;
    idTokens.set(id, uid);
    refreshTokens.set(refresh, uid);
    return { uid, email, id_token: id, refresh_token: refresh, expira_em: 3600 };
  };

  const novaConta = (email: string, senha: string): string => {
    contador++;
    const uid = `uid${contador}`;
    contas.set(email.toLowerCase(), { uid, senha });
    return uid;
  };

  const api: ApiFalsa = {
    contas,
    perfis,
    chamadas,
    offline: false,
    pausado: false,
    comAparelhos: true,
    aparelhos: new Map(),
    colecao: (uid, nome) => {
      const chave = `${uid}/${nome}`;
      if (!colecoes.has(chave)) colecoes.set(chave, new Map());
      return colecoes.get(chave)!;
    },
    invalidarTokens: () => idTokens.clear(),
    invalidarRefresh: () => refreshTokens.clear(),
    criarConta: (email, senha, perfil) => {
      const uid = novaConta(email, senha);
      if (perfil) perfis.set(uid, { ...perfil, uid });
      return uid;
    },

    fetch: (async (url: string, init?: RequestInit) => {
      const caminho = new URL(url).pathname;
      const metodo = init?.method ?? 'GET';
      const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const token = headers.Authorization?.replace(/^Bearer /, '') ?? null;
      chamadas.push({ metodo, caminho, corpo, token });

      if (api.offline) throw new TypeError('Failed to fetch');
      if (api.pausado) return resposta(503, { pausado: true, mensagem: 'olá, estou pausado no momento!' });

      // ---- públicas ----
      if (metodo === 'POST' && caminho === '/auth/registrar') {
        const email = String(corpo.email).toLowerCase();
        if (contas.has(email)) return resposta(400, { detail: 'e-mail ja cadastrado' });
        if (String(corpo.senha).length < 6) return resposta(422, { detail: [{ msg: 'senha curta' }] });
        return resposta(200, sessao(novaConta(email, corpo.senha), email));
      }
      if (metodo === 'POST' && caminho === '/auth/login') {
        const email = String(corpo.email).toLowerCase();
        const conta = contas.get(email);
        if (!conta || conta.senha !== corpo.senha) {
          return resposta(401, { detail: 'e-mail ou senha invalidos' });
        }
        return resposta(200, sessao(conta.uid, email));
      }
      if (metodo === 'POST' && caminho === '/auth/refresh') {
        const uid = refreshTokens.get(corpo.refresh_token);
        if (!uid) return resposta(401, { detail: 'refresh_token invalido' });
        return resposta(200, { ...sessao(uid, null), uid: '' });
      }
      if (metodo === 'POST' && caminho === '/auth/recuperar-senha') {
        return resposta(200, { enviado: true, mensagem: 'se o e-mail existir, enviamos o link' });
      }

      // ---- protegidas ----
      const uid = token ? idTokens.get(token) : undefined;
      if (!uid) return resposta(401, { detail: 'token invalido ou expirado' });

      if (caminho === '/perfil' && metodo === 'GET') {
        const perfil = perfis.get(uid);
        return perfil ? resposta(200, perfil) : resposta(404, { detail: 'perfil nao encontrado' });
      }
      if (caminho === '/perfil' && metodo === 'PUT') {
        const perfil = { ...corpo, uid, atualizado_em: new Date().toISOString() };
        perfis.set(uid, perfil);
        return resposta(200, perfil);
      }

      // ---- proposto: /aparelhos (token de push, RF09) ----
      if (caminho.startsWith('/aparelhos') && api.comAparelhos) {
        if (metodo === 'PUT' && caminho === '/aparelhos') {
          api.aparelhos.set(corpo.token_push, { uid, plataforma: corpo.plataforma });
          return resposta(200, { token_push: corpo.token_push, plataforma: corpo.plataforma });
        }
        if (metodo === 'DELETE') {
          const token = decodeURIComponent(caminho.slice('/aparelhos/'.length));
          if (api.aparelhos.get(token)?.uid !== uid) return resposta(404, { detail: 'aparelho nao encontrado' });
          api.aparelhos.delete(token);
          return resposta(204);
        }
      }

      // ---- coleções: /medicamentos, /doses e /orientacoes (por conta) ----
      const [, nomeColecao, docId] = caminho.split('/');
      if (nomeColecao === 'medicamentos' || nomeColecao === 'doses' || nomeColecao === 'orientacoes') {
        const colecao = api.colecao(uid, nomeColecao);
        const singular = { medicamentos: 'medicamento', doses: 'dose', orientacoes: 'orientacao' }[nomeColecao];
        const agora = new Date().toISOString();

        if (nomeColecao === 'doses' && corpo?.status === 'adiada' && !corpo.novo_horario) {
          return resposta(422, { detail: [{ msg: "status=adiada exige 'novo_horario'" }] });
        }

        if (!docId && metodo === 'GET') return resposta(200, [...colecao.values()]);
        if (!docId && metodo === 'POST') {
          if (nomeColecao !== 'medicamentos' && !api.colecao(uid, 'medicamentos').has(corpo.medicamento_id)) {
            return resposta(404, { detail: 'medicamento nao encontrado' });
          }
          contador++;
          const id = `${singular}${contador}`;
          const doc = nomeColecao === 'doses'
            ? { status: 'pendente', horario_registrado: null, novo_horario: null, ...corpo, id, criado_em: agora }
            : { ...corpo, id, criado_em: agora, atualizado_em: agora };
          colecao.set(id, doc);
          return resposta(201, doc);
        }

        const doc = docId ? colecao.get(docId) : undefined;
        if (!doc) return resposta(404, { detail: `${singular} nao encontrado` });
        if (metodo === 'GET') return resposta(200, doc);
        if (metodo === 'PATCH') {
          const novo = { ...doc, ...corpo, ...(nomeColecao === 'medicamentos' ? { atualizado_em: agora } : {}) };
          colecao.set(docId, novo);
          return resposta(200, novo);
        }
        if (metodo === 'DELETE') {
          colecao.delete(docId);
          return resposta(204);
        }
      }

      return resposta(404, { detail: 'rota nao encontrada' });
    }) as typeof fetch,
  };

  return api;
}
