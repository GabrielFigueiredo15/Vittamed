// Assistente de IA do servidor: POST /chat (CONTRATO.md, seção 8).
//
// O servidor descarta mensagens "system", então o contexto (remédios
// cadastrados) vai junto do texto da última pergunta. O histórico é cortado
// nas últimas mensagens para a chamada não crescer sem limite.

import { ErroApi, ehErroApi, requisitar } from './cliente';

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

export const LIMITE_HISTORICO = 10;

interface RespostaChat {
  resposta: string | null;
  modelo?: string;
}

export function montarMensagens(historico: MensagemChat[], pergunta: string, contexto: string): MensagemChat[] {
  // A conversa precisa começar com "user" depois do corte
  let anteriores = historico.slice(-LIMITE_HISTORICO);
  while (anteriores.length && anteriores[0].role !== 'user') anteriores = anteriores.slice(1);
  return [
    ...anteriores,
    { role: 'user', content: `${contexto}\n\nPergunta: ${pergunta}` },
  ];
}

export async function perguntarIA(
  historico: MensagemChat[],
  pergunta: string,
  contexto: string,
  remedio?: string
): Promise<string> {
  const corpo = await requisitar<RespostaChat>('POST', '/chat', {
    corpo: {
      mensagens: montarMensagens(historico, pergunta, contexto),
      // Busca a bula só quando a pergunta cita um remédio cadastrado
      remedio: remedio ?? null,
      rag: !!remedio,
      temperatura: 0.3,
      max_tokens: 400,
      stream: false,
    },
  });
  const texto = corpo?.resposta?.trim();
  if (!texto) throw new ErroApi('http', 200, 'A IA não enviou resposta.');
  return texto;
}

// Mensagem para a pessoa quando a IA não responde
export function mensagemErroIA(erro: unknown): string {
  if (ehErroApi(erro)) {
    if (erro.tipo === 'sem_conexao' && erro.status === 0) {
      return 'Sem internet agora. Sem conexão, eu só respondo sobre seus horários e remédios cadastrados.';
    }
    if (erro.tipo === 'sem_conexao' || erro.tipo === 'pausado') {
      return 'O assistente está indisponível no momento. Tente de novo em alguns minutos.';
    }
    if (erro.tipo === 'nao_autorizado') return 'Sua sessão expirou. Entre de novo na sua conta.';
  }
  return 'Não consegui responder agora. Tente de novo.';
}
