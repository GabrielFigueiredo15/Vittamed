// Sincronização de remédios, doses e orientações com a API
// (CONTRATO.md, seções 4, 5 e 6).
//
//  enviarFila  -> manda as mudanças locais, em ordem (RF04, RF08, RF12)
//  baixarDados -> lê GET /medicamentos, GET /doses e GET /orientacoes
//  mesclar     -> junta o que veio da API com a cópia local
//
// A cópia local é a que as telas usam. A API é a fonte compartilhada entre
// os aparelhos da mesma conta (pessoa, família, cuidadora — RF03).

import type { Medicamento, Orientacao, StatusDose } from '../notificacoes/tipos';
import { chaveDose, type Registro } from '../interface/doses';
import { tokenPushDoAparelho } from './aparelho';
import { ehErroApi, requisitar } from './cliente';
import {
  concluirOperacao,
  enfileirar,
  estadoSync,
  alterarSync,
  type OperacaoSync,
} from './filaSync';

// ---------- Formatos da API ----------

export interface MedicamentoApi extends Omit<Medicamento, 'id'> {
  id: string;
  atualizado_em?: string | null;
}

export interface DoseApi {
  id: string;
  medicamento_id: string;
  horario_previsto: string;
  status: StatusDose;
  horario_registrado?: string | null;
  novo_horario?: string | null;
  criado_em?: string | null;
}

export interface OrientacaoApi extends Orientacao {
  criado_em?: string | null;
  atualizado_em?: string | null;
}

// O app guarda também o início da validade, que a API não tem
export interface OrientacaoLocal extends Orientacao {
  inicio?: string | null;
}

export interface DadosLocais {
  medicamentos: Medicamento[];
  registros: Registro[];
  orientacoes: OrientacaoLocal[];
}

// A API guarda só a URL da foto. Foto escolhida no aparelho (data URI) fica
// local até existir upload (Firebase Storage ou outro).
const ehUrlRemota = (url?: string | null): boolean => !!url && /^https?:\/\//i.test(url);

export function corpoMedicamento(med: Medicamento): Record<string, unknown> {
  const ag = med.agendamento ?? { tipo: 'fixo' };
  return {
    nome: med.nome,
    dosagem: med.dosagem ?? null,
    forma_uso: med.forma_uso ?? null,
    agendamento: {
      tipo: ag.tipo,
      horarios: ag.horarios ?? [],
      intervalo_horas: ag.intervalo_horas ?? null,
      dias_semana: ag.dias_semana ?? [],
    },
    periodo_inicio: med.periodo_inicio ?? null,
    periodo_fim: med.periodo_fim ?? null,
    observacoes: med.observacoes ?? null,
    foto_url: ehUrlRemota(med.foto_url) ? med.foto_url : null,
    ativo: med.ativo !== false,
  };
}

// ---------- Envio ----------

export type ResultadoEnvio = 'ok' | 'sem_conexao' | 'nao_autorizado';

// Erros que valem tentar de novo mais tarde (a operação fica na fila)
function ehTemporario(erro: unknown): boolean {
  if (!ehErroApi(erro)) return true;
  return erro.tipo !== 'http' || erro.status >= 500 || erro.status === 429;
}

const ehNaoEncontrado = (erro: unknown): boolean => ehErroApi(erro) && erro.status === 404;

async function salvarMedicamento(medId: string, obter: () => DadosLocais): Promise<void> {
  const med = obter().medicamentos.find((m) => m.id === medId);
  if (!med) return; // excluído antes do envio: o med_excluir cuida do resto

  const corpo = corpoMedicamento(med);
  const apiId = estadoSync().idsMed[medId];

  if (apiId) {
    try {
      await requisitar('PATCH', `/medicamentos/${encodeURIComponent(apiId)}`, { corpo });
      return;
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
      // Apagado na API por outro aparelho: cria de novo com os dados daqui
    }
  }

  const criado = await requisitar<MedicamentoApi>('POST', '/medicamentos', { corpo });
  alterarSync((s) => ({ ...s, idsMed: { ...s.idsMed, [medId]: criado.id } }));

  // Excluído enquanto a criação estava a caminho: apaga lá também
  if (!obter().medicamentos.some((m) => m.id === medId)) enfileirar({ tipo: 'med_excluir', medId });
}

async function excluirMedicamento(medId: string): Promise<void> {
  const apiId = estadoSync().idsMed[medId];
  if (apiId) {
    try {
      await requisitar('DELETE', `/medicamentos/${encodeURIComponent(apiId)}`);
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }
  alterarSync((s) => {
    const idsMed = { ...s.idsMed };
    delete idsMed[medId];
    const idsDose = Object.fromEntries(
      Object.entries(s.idsDose).filter(([chave]) => !chave.startsWith(`${medId}|`))
    );
    return { ...s, idsMed, idsDose };
  });
}

async function salvarDose(chave: string, obter: () => DadosLocais): Promise<void> {
  const registro = obter().registros.find((r) => chaveDose(r.medicamento_id, r.horario_previsto) === chave);
  if (!registro) return;
  if (!obter().medicamentos.some((m) => m.id === registro.medicamento_id)) return; // remédio excluído

  // O remédio precisa existir na API antes (POST /doses confere)
  if (!estadoSync().idsMed[registro.medicamento_id]) {
    await salvarMedicamento(registro.medicamento_id, obter);
  }
  const medApi = estadoSync().idsMed[registro.medicamento_id];
  if (!medApi) return;

  const desfecho = {
    status: registro.status,
    horario_registrado: registro.horario_registrado ?? null,
    novo_horario: registro.status === 'adiada' ? registro.novo_horario ?? null : null,
  };
  const tokenPush = await tokenPushDoAparelho();
  const cabecalhos = tokenPush ? { 'X-Token-Push': tokenPush } : undefined;

  const doseApi = estadoSync().idsDose[chave];
  if (doseApi) {
    try {
      await requisitar('PATCH', `/doses/${encodeURIComponent(doseApi)}`, { corpo: desfecho, cabecalhos });
      return;
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }

  // POST já leva o status; o PATCH em seguida grava o horario_registrado
  const criada = await requisitar<DoseApi>('POST', '/doses', {
    corpo: {
      medicamento_id: medApi,
      horario_previsto: new Date(registro.horario_previsto).toISOString(),
      status: desfecho.status,
      novo_horario: desfecho.novo_horario,
    },
    cabecalhos,
  });
  alterarSync((s) => ({ ...s, idsDose: { ...s.idsDose, [chave]: criada.id } }));
  if (desfecho.horario_registrado) {
    await requisitar('PATCH', `/doses/${encodeURIComponent(criada.id)}`, { corpo: desfecho, cabecalhos });
  }
}

async function salvarOrientacao(oriId: string, obter: () => DadosLocais): Promise<void> {
  const o = obter().orientacoes.find((x) => x.id === oriId);
  if (!o) return; // excluída antes do envio
  if (!obter().medicamentos.some((m) => m.id === o.medicamento_id)) return;

  // O remédio precisa existir na API antes (POST /orientacoes confere)
  if (!estadoSync().idsMed[o.medicamento_id]) await salvarMedicamento(o.medicamento_id, obter);
  const medApi = estadoSync().idsMed[o.medicamento_id];
  if (!medApi) return;

  const dados = { texto: o.texto, validade: o.validade ?? null, concluida: !!o.concluida };
  const apiId = estadoSync().idsOri[oriId];
  if (apiId) {
    try {
      await requisitar('PATCH', `/orientacoes/${encodeURIComponent(apiId)}`, { corpo: dados });
      return;
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }

  const criada = await requisitar<OrientacaoApi>('POST', '/orientacoes', {
    corpo: { ...dados, medicamento_id: medApi },
  });
  alterarSync((s) => ({ ...s, idsOri: { ...s.idsOri, [oriId]: criada.id } }));

  // Excluída enquanto a criação estava a caminho: apaga lá também
  if (!obter().orientacoes.some((x) => x.id === oriId)) enfileirar({ tipo: 'ori_excluir', oriId });
}

async function excluirOrientacao(oriId: string): Promise<void> {
  const apiId = estadoSync().idsOri[oriId];
  if (apiId) {
    try {
      await requisitar('DELETE', `/orientacoes/${encodeURIComponent(apiId)}`);
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }
  alterarSync((s) => {
    const idsOri = { ...s.idsOri };
    delete idsOri[oriId];
    return { ...s, idsOri };
  });
}

async function executar(op: OperacaoSync, obter: () => DadosLocais): Promise<void> {
  switch (op.tipo) {
    case 'med_salvar': return salvarMedicamento(op.medId, obter);
    case 'med_excluir': return excluirMedicamento(op.medId);
    case 'dose': return salvarDose(op.chave, obter);
    case 'ori_salvar': return salvarOrientacao(op.oriId, obter);
    case 'ori_excluir': return excluirOrientacao(op.oriId);
  }
}

// Coloca na fila o que existe no aparelho e nunca foi enviado
// (ex.: dados criados antes desta versão do app, ou sem internet).
export function reconciliar(local: DadosLocais): void {
  const s = estadoSync();
  for (const med of local.medicamentos) {
    if (!s.idsMed[med.id]) enfileirar({ tipo: 'med_salvar', medId: med.id });
  }
  const meds = new Set(local.medicamentos.map((m) => m.id));
  for (const r of local.registros) {
    const chave = chaveDose(r.medicamento_id, r.horario_previsto);
    if (meds.has(r.medicamento_id) && !s.idsDose[chave]) enfileirar({ tipo: 'dose', chave });
  }
  for (const o of local.orientacoes) {
    if (meds.has(o.medicamento_id) && !s.idsOri[o.id]) enfileirar({ tipo: 'ori_salvar', oriId: o.id });
  }
}

// Envia a fila em ordem. Para no primeiro erro temporário (sem internet,
// servidor fora, sessão expirada) e mantém o resto para a próxima vez.
// Erro definitivo (ex.: 422 de dado inválido) descarta só aquela operação,
// para não travar a fila para sempre.
export async function enviarFila(obter: () => DadosLocais): Promise<ResultadoEnvio> {
  for (let i = 0; i < 1000; i++) {
    const op = estadoSync().fila[0];
    if (!op) return 'ok';
    try {
      await executar(op, obter);
    } catch (erro) {
      if (ehTemporario(erro)) {
        console.log(erro);
        return ehErroApi(erro) && erro.tipo === 'nao_autorizado' ? 'nao_autorizado' : 'sem_conexao';
      }
      console.log('Operação descartada pela API:', op, erro);
    }
    concluirOperacao(op);
  }
  return 'ok';
}

// ---------- Download e junção ----------

export interface DadosApi {
  medicamentos: MedicamentoApi[];
  doses: DoseApi[];
  orientacoes: OrientacaoApi[];
}

export async function baixarDados(): Promise<DadosApi> {
  const [medicamentos, doses, orientacoes] = await Promise.all([
    requisitar<MedicamentoApi[]>('GET', '/medicamentos'),
    requisitar<DoseApi[]>('GET', '/doses'),
    requisitar<OrientacaoApi[]>('GET', '/orientacoes'),
  ]);
  return { medicamentos: medicamentos ?? [], doses: doses ?? [], orientacoes: orientacoes ?? [] };
}

export interface IdsApi {
  idsMed: Record<string, string>;
  idsDose: Record<string, string>;
  idsOri: Record<string, string>;
}

export interface Mesclado extends IdsApi {
  medicamentos: Medicamento[];
  registros: Registro[];
  orientacoes: OrientacaoLocal[];
}

const quando = (d: DoseApi): number =>
  new Date(d.horario_registrado ?? d.criado_em ?? 0).getTime() || 0;

// Junta os dados da API com os locais. Só deve ser chamada com a fila vazia:
// aí tudo o que foi feito aqui já está na API e ela vale para os itens ligados.
//  - item ligado que sumiu da API foi excluído em outro aparelho: sai daqui;
//  - item local nunca enviado continua (vai na próxima fila);
//  - item novo da API entra com o id da API como id local.
export function mesclar(local: DadosLocais, ids: IdsApi, api: DadosApi): Mesclado {
  const localPorApi = new Map(Object.entries(ids.idsMed).map(([loc, apiId]) => [apiId, loc]));
  const daApi = new Map(api.medicamentos.map((m) => [m.id, m]));
  const idsMed: Record<string, string> = {};

  const converter = (m: MedicamentoApi, id: string, antes?: Medicamento): Medicamento => {
    const { atualizado_em: _a, id: _id, ...dados } = m;
    return {
      ...dados,
      id,
      // A âncora dos lembretes por intervalo usa o criado_em: mantém o local
      criado_em: antes?.criado_em ?? m.criado_em ?? null,
      foto_url: m.foto_url ?? (antes && !ehUrlRemota(antes.foto_url) ? antes.foto_url ?? null : null),
    };
  };

  // Mantém a ordem da lista local; os novos da API entram no fim
  const medicamentos: Medicamento[] = [];
  for (const m of local.medicamentos) {
    const apiId = ids.idsMed[m.id];
    if (!apiId) {
      medicamentos.push(m);                       // nunca enviado: continua
    } else if (daApi.has(apiId)) {
      idsMed[m.id] = apiId;
      medicamentos.push(converter(daApi.get(apiId)!, m.id, m));
    }                                             // ligado e sumiu da API: excluído lá
  }
  for (const m of api.medicamentos) {
    if (localPorApi.has(m.id)) continue;
    idsMed[m.id] = m.id;
    medicamentos.push(converter(m, m.id));
  }
  const existentes = new Set(medicamentos.map((m) => m.id));

  // Doses da API: uma por remédio + horário (a registrada por último)
  const medLocalDaApi = new Map(Object.entries(idsMed).map(([loc, apiId]) => [apiId, loc]));
  const melhores = new Map<string, DoseApi & { medLocal: string }>();
  for (const d of api.doses) {
    if (d.status === 'pendente') continue; // sem desfecho: no app, "pendente" é não ter registro
    const medLocal = medLocalDaApi.get(d.medicamento_id);
    if (!medLocal) continue;
    const chave = chaveDose(medLocal, d.horario_previsto);
    const atual = melhores.get(chave);
    if (!atual || quando(d) >= quando(atual)) melhores.set(chave, { ...d, medLocal });
  }

  const idsDose: Record<string, string> = {};
  const registros: Registro[] = [];
  for (const [chave, d] of melhores) {
    idsDose[chave] = d.id;
    registros.push({
      id: d.id,
      medicamento_id: d.medLocal,
      horario_previsto: new Date(d.horario_previsto).toISOString(),
      status: d.status,
      horario_registrado: d.horario_registrado ?? null,
      novo_horario: d.novo_horario ?? null,
    });
  }
  for (const r of local.registros) {
    const chave = chaveDose(r.medicamento_id, r.horario_previsto);
    if (idsDose[chave] || ids.idsDose[chave]) continue; // veio da API, ou foi apagada lá
    if (existentes.has(r.medicamento_id)) registros.push(r);
  }

  // Orientações: mesma regra dos remédios, mantendo a ordem local.
  // O início da validade só existe no aparelho: é mantido.
  const oriDaApi = new Map(api.orientacoes.map((o) => [o.id, o]));
  const oriLocalPorApi = new Map(Object.entries(ids.idsOri).map(([loc, apiId]) => [apiId, loc]));
  const idsOri: Record<string, string> = {};
  const converterOri = (o: OrientacaoApi, id: string, medicamento_id: string, antes?: OrientacaoLocal): OrientacaoLocal => ({
    id,
    medicamento_id,
    texto: o.texto,
    validade: o.validade ?? null,
    concluida: !!o.concluida,
    ...(antes?.inicio !== undefined ? { inicio: antes.inicio } : {}),
  });

  const orientacoes: OrientacaoLocal[] = [];
  for (const o of local.orientacoes) {
    if (!existentes.has(o.medicamento_id)) continue;   // remédio excluído
    const apiId = ids.idsOri[o.id];
    if (!apiId) {
      orientacoes.push(o);                              // nunca enviada: continua
    } else if (oriDaApi.has(apiId)) {
      idsOri[o.id] = apiId;
      orientacoes.push(converterOri(oriDaApi.get(apiId)!, o.id, o.medicamento_id, o));
    }                                                   // ligada e sumiu da API: excluída lá
  }
  for (const o of api.orientacoes) {
    if (oriLocalPorApi.has(o.id)) continue;
    const medLocal = medLocalDaApi.get(o.medicamento_id);
    if (!medLocal) continue;                            // remédio que não existe mais
    idsOri[o.id] = o.id;
    orientacoes.push(converterOri(o, o.id, medLocal));
  }

  return { medicamentos, registros, orientacoes, idsMed, idsDose, idsOri };
}
