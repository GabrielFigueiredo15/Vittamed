// Registro do aparelho na conta, para o aviso à família (RF09).
//
// ⚠ O endpoint ainda NÃO existe no backend (CONTRATO.md não tem). Este é o
// formato proposto ao time do backend:
//
//   PUT    /aparelhos            { "token_push": "...", "plataforma": "android" | "ios" }
//          -> 200. Guarda (ou move) o token para a conta do Bearer.
//   DELETE /aparelhos/{token_push}
//          -> 204 (ou 404 se não existir). Chamado ao sair da conta.
//
// Quando uma dose for marcada como nao_tomada, o backend envia um push para
// os outros aparelhos da conta pelo serviço do Expo, com
//   channelId: "familia", data: { tipo: "aviso_familia", medicamentoId, horarioPrevisto }.
//
// Enquanto o endpoint não existir (404/405), o registro fica pendente e é
// tentado de novo na próxima abertura do app, sem erro para a pessoa.

import { lerValor, salvarValor } from '../notificacoes/armazenamento';
import { obterTokenPush, type MotivoSemToken } from '../notificacoes/push';
import { ehErroApi, requisitar } from './cliente';
import { sessaoAtual } from './sessao';

const CHAVE_APARELHO = '@vittamed_aparelho_push';

interface Registrado {
  token: string;
  uid: string;                       // conta em que o token foi registrado
}

export type ResultadoRegistro =
  | 'registrado'                     // enviado agora
  | 'ja_registrado'                  // mesmo token e mesma conta: nada a fazer
  | 'pendente'                       // sem internet ou endpoint ainda não existe
  | MotivoSemToken;                  // não foi possível obter o token

async function lerRegistrado(): Promise<Registrado | null> {
  try {
    const bruto = await lerValor(CHAVE_APARELHO);
    return bruto ? (JSON.parse(bruto) as Registrado) : null;
  } catch {
    return null;
  }
}

async function guardarRegistrado(r: Registrado | null): Promise<void> {
  await salvarValor(CHAVE_APARELHO, r ? JSON.stringify(r) : '');
}

// Endpoint ainda não implementado no backend
const endpointAusente = (erro: unknown): boolean =>
  ehErroApi(erro) && (erro.status === 404 || erro.status === 405);

let emAndamento: Promise<ResultadoRegistro> | null = null;

// Registra o token deste aparelho na conta logada. Pode ser chamada sempre
// (ao entrar, ao abrir o app, quando o token muda): só envia se mudou algo.
export function registrarAparelho(): Promise<ResultadoRegistro> {
  if (!emAndamento) {
    emAndamento = (async (): Promise<ResultadoRegistro> => {
      const sessao = sessaoAtual();
      if (!sessao) return 'pendente';

      const resultado = await obterTokenPush();
      if (!resultado.ok) {
        if (resultado.motivo === 'erro') console.log('Token de push:', resultado.detalhe);
        return resultado.motivo;
      }

      const anterior = await lerRegistrado();
      if (anterior && anterior.token === resultado.token && anterior.uid === sessao.uid) return 'ja_registrado';

      try {
        await requisitar('PUT', '/aparelhos', {
          corpo: { token_push: resultado.token, plataforma: resultado.plataforma },
        });
      } catch (erro) {
        if (!endpointAusente(erro)) console.log(erro);
        return 'pendente';
      }
      await guardarRegistrado({ token: resultado.token, uid: sessao.uid });
      return 'registrado';
    })().finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

// Token deste aparelho, se já registrado na conta logada. Vai no header
// X-Token-Push do /doses para este aparelho não receber o próprio aviso (RF09).
export async function tokenPushDoAparelho(): Promise<string | null> {
  const registrado = await lerRegistrado();
  const sessao = sessaoAtual();
  return registrado && sessao && registrado.uid === sessao.uid ? registrado.token : null;
}

// Ao sair da conta: este aparelho para de receber os avisos dela.
// Precisa rodar ANTES de descartar os tokens da sessão.
export async function desregistrarAparelho(): Promise<void> {
  const registrado = await lerRegistrado();
  if (!registrado) return;
  try {
    await requisitar('DELETE', `/aparelhos/${encodeURIComponent(registrado.token)}`);
  } catch (erro) {
    // Sem internet: o backend também deve trocar o dono do token quando outra
    // conta registrar este aparelho, e apagar tokens que o Expo recusar.
    if (!(ehErroApi(erro) && erro.status === 404) && !endpointAusente(erro)) console.log(erro);
  }
  await guardarRegistrado(null);
}
