// Fila de envio para a API e ligação entre ids locais e ids da API.
//
// O app usa os próprios ids (notificações, registros e orientações dependem
// deles). Esta tabela diz qual documento da API corresponde a cada um.
// A fila guarda o que ainda precisa ser enviado; ela sobrevive ao fechar o
// app e é enviada quando houver internet.
//
// Fica fora do estado do React para ser lida e alterada na hora, sem esperar
// uma nova renderização.

import { lerValor, salvarValor } from '../notificacoes/armazenamento';

const CHAVE_SYNC = '@vittamed_sync_api';

export type OperacaoSync =
  | { tipo: 'med_salvar'; medId: string }
  | { tipo: 'med_excluir'; medId: string }
  | { tipo: 'dose'; chave: string }             // chaveDose(medId, horario_previsto)
  | { tipo: 'ori_salvar'; oriId: string }
  | { tipo: 'ori_excluir'; oriId: string };

export interface EstadoSync {
  uid: string | null;                           // conta dona desta fila
  fila: OperacaoSync[];
  idsMed: Record<string, string>;               // id local -> id na API
  idsDose: Record<string, string>;              // chaveDose -> id da dose na API
  idsOri: Record<string, string>;               // id local da orientação -> id na API
}

const vazio = (uid: string | null): EstadoSync => ({ uid, fila: [], idsMed: {}, idsDose: {}, idsOri: {} });

let atual: EstadoSync = vazio(null);

// Grava uma cópia por vez, sempre a mais recente
let gravando: Promise<void> = Promise.resolve();
function persistir(): void {
  const copia = JSON.stringify(atual);
  gravando = gravando.then(() => salvarValor(CHAVE_SYNC, copia)).catch((e) => console.log(e));
}

export function estadoSync(): EstadoSync {
  return atual;
}

export function alterarSync(fn: (s: EstadoSync) => EstadoSync): void {
  atual = fn(atual);
  persistir();
}

export async function carregarSync(): Promise<EstadoSync> {
  try {
    const bruto = await lerValor(CHAVE_SYNC);
    const salvo = bruto ? (JSON.parse(bruto) as Partial<EstadoSync>) : null;
    // Cópias salvas por versões anteriores podem não ter idsOri: o vazio completa
    atual = salvo ? { ...vazio(salvo.uid ?? null), ...salvo } : vazio(null);
  } catch (erro) {
    console.log(erro);
    atual = vazio(null);
  }
  return atual;
}

// Outra conta entrou neste aparelho: começa uma fila e uma tabela novas
export function prepararSync(uid: string): void {
  if (atual.uid !== uid) {
    atual = vazio(uid);
    persistir();
  }
}

export function limparSyncParaTestes(): void {
  atual = vazio(null);
}

// Identificador do item que a operação mexe (remédio, dose ou orientação)
const alvo = (op: OperacaoSync): string =>
  op.tipo === 'dose' ? op.chave : 'oriId' in op ? op.oriId : op.medId;

const mesmaOp = (a: OperacaoSync, b: OperacaoSync): boolean => a.tipo === b.tipo && alvo(a) === alvo(b);

const doseDoMed = (op: OperacaoSync, medId: string): boolean =>
  op.tipo === 'dose' && op.chave.startsWith(`${medId}|`);

// Coloca uma operação na fila sem repetir:
//  - salvar o mesmo remédio ou a mesma dose duas vezes vira uma só
//    (os dados são lidos na hora do envio, então vai a versão mais nova);
//  - excluir um remédio tira da fila o que ainda ia ser enviado dele;
//  - excluir uma orientação tira da fila o envio dela.
export function enfileirar(op: OperacaoSync): void {
  alterarSync((s) => {
    if (op.tipo === 'ori_excluir') {
      const fila = s.fila.filter((o) => !(o.tipo === 'ori_salvar' && o.oriId === op.oriId));
      if (!s.idsOri[op.oriId]) return { ...s, fila };
      if (fila.some((o) => mesmaOp(o, op))) return { ...s, fila };
      return { ...s, fila: [...fila, op] };
    }
    if (op.tipo === 'med_excluir') {
      const fila = s.fila.filter(
        (o) => !(o.tipo === 'med_salvar' && o.medId === op.medId) && !doseDoMed(o, op.medId)
      );
      // Nunca chegou à API: não há o que excluir lá
      if (!s.idsMed[op.medId]) return { ...s, fila };
      return { ...s, fila: [...fila, op] };
    }
    if (s.fila.some((o) => mesmaOp(o, op))) return s;
    return { ...s, fila: [...s.fila, op] };
  });
}

// Tira da fila a operação já enviada (a primeira igual a ela)
export function concluirOperacao(op: OperacaoSync): void {
  alterarSync((s) => {
    const i = s.fila.findIndex((o) => mesmaOp(o, op));
    if (i < 0) return s;
    return { ...s, fila: [...s.fila.slice(0, i), ...s.fila.slice(i + 1)] };
  });
}
