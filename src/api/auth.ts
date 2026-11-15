// Autenticação (CONTRATO.md, seção 2) e perfil do paciente (seção 3).

import { ErroApi, ehErroApi, requisitar } from './cliente';
import { converterSessao, guardarSessao, limparSessao, type SessaoApi, type SessaoResposta } from './sessao';

export async function registrar(email: string, senha: string): Promise<SessaoApi> {
  const r = await requisitar<SessaoResposta>('POST', '/auth/registrar', {
    corpo: { email: email.trim(), senha },
    autenticado: false,
  });
  const sessao = converterSessao(r);
  await guardarSessao(sessao);
  return sessao;
}

export async function login(email: string, senha: string): Promise<SessaoApi> {
  const r = await requisitar<SessaoResposta>('POST', '/auth/login', {
    corpo: { email: email.trim(), senha },
    autenticado: false,
  });
  const sessao = converterSessao(r);
  await guardarSessao(sessao);
  return sessao;
}

// A API responde 200 mesmo se o e-mail não existir (por segurança)
export async function recuperarSenha(email: string): Promise<void> {
  await requisitar('POST', '/auth/recuperar-senha', {
    corpo: { email: email.trim() },
    autenticado: false,
  });
}

// Logout é no cliente: descarta os tokens
export async function sair(): Promise<void> {
  await limparSessao();
}

// ---------- Perfil ----------

export interface Perfil {
  nome: string;
  data_nascimento?: string | null;  // "YYYY-MM-DD"
  telefone?: string | null;
  email?: string | null;
  uid?: string;
  atualizado_em?: string | null;
}

// null quando a conta ainda não tem perfil (404)
export async function lerPerfil(): Promise<Perfil | null> {
  try {
    return await requisitar<Perfil>('GET', '/perfil');
  } catch (erro) {
    if (ehErroApi(erro) && erro.status === 404) return null;
    throw erro;
  }
}

export async function salvarPerfil(perfil: Perfil): Promise<Perfil> {
  const { uid: _uid, atualizado_em: _atualizado, ...corpo } = perfil;
  return requisitar<Perfil>('PUT', '/perfil', { corpo });
}

// ---------- Mensagens para a tela ----------

// Traduz o erro da API para uma frase curta e clara (RNF05)
export function mensagemErro(erro: unknown, contexto: 'login' | 'registrar' | 'geral' = 'geral'): string {
  if (!(erro instanceof ErroApi)) return 'Algo deu errado. Tente de novo.';

  switch (erro.tipo) {
    case 'sem_conexao':
      return 'Sem conexão com a internet. Verifique o Wi-Fi ou os dados móveis e tente de novo.';
    case 'pausado':
      return 'O Vittamed está em manutenção. Tente de novo em alguns minutos.';
    case 'nao_autorizado':
      return contexto === 'login' ? 'E-mail ou senha incorretos.' : 'Sua sessão expirou. Entre de novo.';
  }

  const texto = erro.message.toLowerCase();
  if (texto.includes('ja cadastrado') || texto.includes('já cadastrado')) {
    return 'Já existe uma conta com este e-mail. Toque em "Entrar".';
  }
  if (texto.includes('muitas tentativas') || erro.status === 429) {
    return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  }
  if (texto.includes('desativada') || erro.status === 403) return 'Esta conta está desativada.';
  if (texto.includes('e-mail invalido') || texto.includes('valid email')) return 'Digite um e-mail válido.';
  if (texto.includes('senha muito curta')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return contexto === 'registrar'
    ? 'Não foi possível criar a conta. Tente de novo.'
    : 'Não foi possível concluir. Tente de novo.';
}
