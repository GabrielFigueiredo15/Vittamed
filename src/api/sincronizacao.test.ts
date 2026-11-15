// Testes da sincronização de remédios e doses com a API (simulada).
import type { Medicamento } from '../notificacoes/tipos';
import { chaveDose, type Registro } from '../interface/doses';
import { criarApiFalsa, type ApiFalsa } from './apiFalsa';
import { definirFetch } from './cliente';
import { login } from './auth';
import { limparSessao } from './sessao';
import { enfileirar, estadoSync, limparSyncParaTestes, prepararSync } from './filaSync';
import {
  corpoMedicamento,
  enviarFila,
  mesclar,
  reconciliar,
  type DadosLocais,
  type DoseApi,
  type MedicamentoApi,
  type OrientacaoApi,
  type OrientacaoLocal,
} from './sincronizacao';

let api: ApiFalsa;
let uid: string;
let local: DadosLocais;
const obter = () => local;

const med = (id: string, nome = `Remédio ${id}`): Medicamento => ({
  id,
  nome,
  dosagem: '50 mg',
  agendamento: { tipo: 'fixo', horarios: ['08:00', '20:00'] },
  ativo: true,
  criado_em: '2026-10-01T10:00:00.000Z',
});

const registro = (medId: string, status: Registro['status'], extra: Partial<Registro> = {}): Registro => ({
  id: `d_${medId}`,
  medicamento_id: medId,
  horario_previsto: '2026-10-12T23:00:00.000Z',
  status,
  horario_registrado: '2026-10-12T23:05:00.000Z',
  novo_horario: null,
  ...extra,
});

const ori = (id: string, medicamento_id: string, extra: Partial<OrientacaoLocal> = {}): OrientacaoLocal => ({
  id, medicamento_id, texto: `Orientação ${id}`, inicio: '2026-09-01', validade: '2026-10-01', concluida: false, ...extra,
});

const meds = () => api.colecao(uid, 'medicamentos');
const orientacoesApi = () => api.colecao(uid, 'orientacoes');
const doses = () => api.colecao(uid, 'doses');
const chamadas = (metodo: string, prefixo: string) =>
  api.chamadas.filter((c) => c.metodo === metodo && c.caminho.startsWith(prefixo));

beforeEach(async () => {
  api = criarApiFalsa();
  definirFetch(api.fetch);
  await limparSessao();
  limparSyncParaTestes();
  uid = api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  await login('maria@ex.com', 'Senha12345');
  prepararSync(uid);
  local = { medicamentos: [], registros: [], orientacoes: [] };
});

afterAll(() => definirFetch(null));

describe('remédios', () => {
  test('cria na API e guarda o id; salvar de novo atualiza', async () => {
    local.medicamentos = [med('m1')];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    expect(await enviarFila(obter)).toBe('ok');

    const apiId = estadoSync().idsMed.m1;
    expect(meds().get(apiId)).toMatchObject({ nome: 'Remédio m1', dosagem: '50 mg' });

    local.medicamentos = [{ ...med('m1'), nome: 'Losartana' }];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    await enviarFila(obter);
    expect(meds().size).toBe(1);
    expect(meds().get(apiId)).toMatchObject({ nome: 'Losartana' });
    expect(estadoSync().fila).toEqual([]);
  });

  test('salvar várias vezes antes de enviar faz uma só chamada', async () => {
    local.medicamentos = [med('m1')];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    await enviarFila(obter);
    expect(chamadas('POST', '/medicamentos')).toHaveLength(1);
  });

  test('excluir apaga na API', async () => {
    local.medicamentos = [med('m1')];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    await enviarFila(obter);

    local.medicamentos = [];
    enfileirar({ tipo: 'med_excluir', medId: 'm1' });
    await enviarFila(obter);
    expect(meds().size).toBe(0);
    expect(estadoSync().idsMed.m1).toBeUndefined();
  });

  test('excluir um remédio que nunca foi enviado não chama a API', async () => {
    local.medicamentos = [med('m1')];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    local.medicamentos = [];
    enfileirar({ tipo: 'med_excluir', medId: 'm1' });

    await enviarFila(obter);
    expect(api.chamadas.filter((c) => c.caminho.startsWith('/medicamentos'))).toHaveLength(0);
  });

  test('apagado na API por outro aparelho: editar aqui cria de novo', async () => {
    local.medicamentos = [med('m1')];
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    await enviarFila(obter);
    meds().clear();

    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    await enviarFila(obter);
    expect(meds().size).toBe(1);
    expect(estadoSync().idsMed.m1).toBe([...meds().keys()][0]);
  });

  test('foto escolhida no aparelho (data URI) não vai para a API; URL vai', () => {
    expect(corpoMedicamento({ ...med('m1'), foto_url: 'data:image/jpeg;base64,AAAA' }).foto_url).toBeNull();
    expect(corpoMedicamento({ ...med('m1'), foto_url: 'https://x.com/f.jpg' }).foto_url).toBe('https://x.com/f.jpg');
  });
});

describe('doses (RF08)', () => {
  test('registro novo: cria o remédio, cria a dose com status e grava o horário registrado', async () => {
    local.medicamentos = [med('m1')];
    local.registros = [registro('m1', 'tomada')];
    enfileirar({ tipo: 'dose', chave: chaveDose('m1', local.registros[0].horario_previsto) });

    expect(await enviarFila(obter)).toBe('ok');
    const [dose] = [...doses().values()];
    expect(dose).toMatchObject({
      medicamento_id: estadoSync().idsMed.m1,
      horario_previsto: '2026-10-12T23:00:00.000Z',
      status: 'tomada',
      horario_registrado: '2026-10-12T23:05:00.000Z',
    });
  });

  test('mudar o desfecho da mesma dose só atualiza (PATCH)', async () => {
    local.medicamentos = [med('m1')];
    local.registros = [registro('m1', 'adiada', { novo_horario: '2026-10-12T23:15:00.000Z' })];
    const chave = chaveDose('m1', local.registros[0].horario_previsto);
    enfileirar({ tipo: 'dose', chave });
    await enviarFila(obter);

    local.registros = [registro('m1', 'tomada', { horario_registrado: '2026-10-12T23:16:00.000Z' })];
    enfileirar({ tipo: 'dose', chave });
    await enviarFila(obter);

    expect(doses().size).toBe(1);
    expect([...doses().values()][0]).toMatchObject({
      status: 'tomada',
      novo_horario: null,
      horario_registrado: '2026-10-12T23:16:00.000Z',
    });
    expect(chamadas('POST', '/doses')).toHaveLength(1);
  });

  test('adiada leva o novo_horario', async () => {
    local.medicamentos = [med('m1')];
    local.registros = [registro('m1', 'adiada', { novo_horario: '2026-10-12T23:15:00.000Z' })];
    enfileirar({ tipo: 'dose', chave: chaveDose('m1', local.registros[0].horario_previsto) });
    await enviarFila(obter);
    expect([...doses().values()][0]).toMatchObject({ status: 'adiada', novo_horario: '2026-10-12T23:15:00.000Z' });
  });

  test('dose de remédio excluído é descartada', async () => {
    local.registros = [registro('m1', 'tomada')];
    enfileirar({ tipo: 'dose', chave: chaveDose('m1', local.registros[0].horario_previsto) });
    expect(await enviarFila(obter)).toBe('ok');
    expect(doses().size).toBe(0);
    expect(estadoSync().fila).toEqual([]);
  });
});

describe('fila', () => {
  test('sem internet guarda tudo e envia em ordem quando volta', async () => {
    local.medicamentos = [med('m1')];
    local.registros = [registro('m1', 'nao_tomada')];
    api.offline = true;
    enfileirar({ tipo: 'med_salvar', medId: 'm1' });
    enfileirar({ tipo: 'dose', chave: chaveDose('m1', local.registros[0].horario_previsto) });

    expect(await enviarFila(obter)).toBe('sem_conexao');
    expect(estadoSync().fila).toHaveLength(2);

    api.offline = false;
    expect(await enviarFila(obter)).toBe('ok');
    expect(meds().size).toBe(1);
    expect([...doses().values()][0]).toMatchObject({ status: 'nao_tomada' });
  });

  test('dado recusado pela API (422) é descartado e não trava o resto', async () => {
    local.medicamentos = [med('m1'), med('m2')];
    local.registros = [registro('m1', 'adiada', { novo_horario: null })]; // 422: adiada sem novo_horario
    enfileirar({ tipo: 'dose', chave: chaveDose('m1', local.registros[0].horario_previsto) });
    enfileirar({ tipo: 'med_salvar', medId: 'm2' });

    expect(await enviarFila(obter)).toBe('ok');
    expect(doses().size).toBe(0);
    expect([...meds().values()].map((m) => m.nome)).toContain('Remédio m2');
  });

  test('reconciliar coloca na fila o que nunca foi enviado', async () => {
    local.medicamentos = [med('m1'), med('m2')];
    local.registros = [registro('m1', 'tomada'), registro('sumiu', 'tomada')];
    reconciliar(local);
    expect(estadoSync().fila.map((o) => o.tipo)).toEqual(['med_salvar', 'med_salvar', 'dose']);

    await enviarFila(obter);
    reconciliar(local);
    expect(estadoSync().fila).toEqual([]);
  });
});

describe('mesclar', () => {
  const medApi = (id: string, nome: string): MedicamentoApi => ({
    ...med(id, nome),
    id,
    criado_em: '2026-10-05T10:00:00Z',
  });
  const doseApi = (id: string, medicamento_id: string, status: DoseApi['status'], registrado: string): DoseApi => ({
    id,
    medicamento_id,
    horario_previsto: '2026-10-12T23:00:00Z',
    status,
    horario_registrado: registrado,
  });

  test('junta com a cópia local mantendo a ordem e os ids locais', () => {
    const resultado = mesclar(
      {
        medicamentos: [
          med('m_ligado', 'Velho'),
          med('m_novo_local', 'Criado sem internet'),
          { ...med('m_apagado_la'), foto_url: null },
        ],
        registros: [],
        orientacoes: [ori('o1', 'm_apagado_la'), ori('o2', 'm_ligado')],
      },
      { idsMed: { m_ligado: 'A', m_apagado_la: 'B' }, idsDose: {}, idsOri: {} },
      { medicamentos: [medApi('A', 'Atualizado'), medApi('C', 'Da família')], doses: [], orientacoes: [] }
    );

    expect(resultado.medicamentos.map((m) => [m.id, m.nome])).toEqual([
      ['m_ligado', 'Atualizado'],
      ['m_novo_local', 'Criado sem internet'],
      ['C', 'Da família'],
    ]);
    // A âncora dos lembretes por intervalo não muda
    expect(resultado.medicamentos[0].criado_em).toBe('2026-10-01T10:00:00.000Z');
    expect(resultado.idsMed).toEqual({ m_ligado: 'A', C: 'C' });
    expect(resultado.orientacoes.map((o) => o.id)).toEqual(['o2']);
  });

  test('foto local continua quando a API não tem foto', () => {
    const r = mesclar(
      { medicamentos: [{ ...med('m1'), foto_url: 'data:image/jpeg;base64,AAAA' }], registros: [], orientacoes: [] },
      { idsMed: { m1: 'A' }, idsDose: {}, idsOri: {} },
      { medicamentos: [{ ...medApi('A', 'X'), foto_url: null }], doses: [], orientacoes: [] }
    );
    expect(r.medicamentos[0].foto_url).toBe('data:image/jpeg;base64,AAAA');
  });

  test('doses: vale a registrada por último; pendente da API é ignorada', () => {
    const r = mesclar(
      {
        medicamentos: [med('m1')],
        registros: [registro('m1', 'adiada', { horario_previsto: '2026-10-13T11:00:00.000Z' })],
        orientacoes: [],
      },
      { idsMed: { m1: 'A' }, idsDose: {}, idsOri: {} },
      {
        medicamentos: [medApi('A', 'X')],
        doses: [
          doseApi('d1', 'A', 'adiada', '2026-10-12T23:01:00Z'),
          doseApi('d2', 'A', 'tomada', '2026-10-12T23:20:00Z'),
          { ...doseApi('d3', 'A', 'pendente', '2026-10-12T23:30:00Z'), horario_previsto: '2026-10-14T11:00:00Z' },
        ],
        orientacoes: [],
      }
    );

    expect(r.registros).toHaveLength(2);
    const daApi = r.registros.find((x) => x.id === 'd2')!;
    expect(daApi).toMatchObject({ medicamento_id: 'm1', status: 'tomada', horario_previsto: '2026-10-12T23:00:00.000Z' });
    expect(r.idsDose[chaveDose('m1', '2026-10-12T23:00:00Z')]).toBe('d2');
    // O registro local que nunca foi enviado continua
    expect(r.registros.some((x) => x.horario_previsto === '2026-10-13T11:00:00.000Z')).toBe(true);
  });

  test('dose ligada que sumiu da API (apagada em outro aparelho) sai daqui', () => {
    const local = registro('m1', 'tomada');
    const chave = chaveDose('m1', local.horario_previsto);
    const r = mesclar(
      { medicamentos: [med('m1')], registros: [local], orientacoes: [] },
      { idsMed: { m1: 'A' }, idsDose: { [chave]: 'd9' }, idsOri: {} },
      { medicamentos: [medApi('A', 'X')], doses: [], orientacoes: [] }
    );
    expect(r.registros).toEqual([]);
  });
});

describe('orientações (RF12, RF14)', () => {
  test('cria o remédio antes, cria a orientação e guarda o id; concluir atualiza', async () => {
    local.medicamentos = [med('m1')];
    local.orientacoes = [ori('o1', 'm1')];
    enfileirar({ tipo: 'ori_salvar', oriId: 'o1' });
    expect(await enviarFila(obter)).toBe('ok');

    const apiId = estadoSync().idsOri.o1;
    expect(orientacoesApi().get(apiId)).toMatchObject({
      medicamento_id: estadoSync().idsMed.m1,
      texto: 'Orientação o1',
      validade: '2026-10-01',
      concluida: false,
    });
    // O início da validade não existe na API
    expect(orientacoesApi().get(apiId)).not.toHaveProperty('inicio');

    local.orientacoes = [ori('o1', 'm1', { concluida: true })];
    enfileirar({ tipo: 'ori_salvar', oriId: 'o1' });
    await enviarFila(obter);
    expect(orientacoesApi().size).toBe(1);
    expect(orientacoesApi().get(apiId)).toMatchObject({ concluida: true });
  });

  test('excluir apaga na API; excluir antes de enviar não chama a API', async () => {
    local.medicamentos = [med('m1')];
    local.orientacoes = [ori('o1', 'm1'), ori('o2', 'm1')];
    enfileirar({ tipo: 'ori_salvar', oriId: 'o1' });
    await enviarFila(obter);

    enfileirar({ tipo: 'ori_salvar', oriId: 'o2' });
    local.orientacoes = [];
    enfileirar({ tipo: 'ori_excluir', oriId: 'o1' });
    enfileirar({ tipo: 'ori_excluir', oriId: 'o2' });
    await enviarFila(obter);

    expect(orientacoesApi().size).toBe(0);
    expect(chamadas('POST', '/orientacoes')).toHaveLength(1);
    expect(estadoSync().idsOri).toEqual({});
  });

  test('excluir o remédio com orientações apaga as duas coisas na API', async () => {
    local.medicamentos = [med('m1')];
    local.orientacoes = [ori('o1', 'm1')];
    reconciliar(local);
    await enviarFila(obter);

    local.medicamentos = [];
    local.orientacoes = [];
    enfileirar({ tipo: 'ori_excluir', oriId: 'o1' });
    enfileirar({ tipo: 'med_excluir', medId: 'm1' });
    await enviarFila(obter);
    expect(orientacoesApi().size).toBe(0);
    expect(meds().size).toBe(0);
  });

  test('reconciliar envia orientações nunca enviadas', async () => {
    local.medicamentos = [med('m1')];
    local.orientacoes = [ori('o1', 'm1'), ori('o_sem_remedio', 'sumiu')];
    reconciliar(local);
    expect(estadoSync().fila).toEqual([
      { tipo: 'med_salvar', medId: 'm1' },
      { tipo: 'ori_salvar', oriId: 'o1' },
    ]);
  });

  test('mesclar: atualiza as ligadas mantendo o início, remove as apagadas lá e traz as novas', () => {
    const oriApi = (id: string, medicamento_id: string, extra: Partial<OrientacaoApi> = {}): OrientacaoApi => ({
      id, medicamento_id, texto: `API ${id}`, validade: '2026-11-01', concluida: false, ...extra,
    });
    const r = mesclar(
      {
        medicamentos: [med('m1')],
        registros: [],
        orientacoes: [
          ori('o_ligada', 'm1', { inicio: '2026-08-15' }),
          ori('o_apagada_la', 'm1'),
          ori('o_nova_local', 'm1'),
        ],
      },
      { idsMed: { m1: 'A' }, idsDose: {}, idsOri: { o_ligada: 'X', o_apagada_la: 'Y' } },
      {
        medicamentos: [{ ...med('A', 'Remédio'), id: 'A' }],
        doses: [],
        orientacoes: [
          oriApi('X', 'A', { concluida: true }),
          oriApi('Z', 'A'),
          oriApi('W', 'remedio_desconhecido'),
        ],
      }
    );

    expect(r.orientacoes.map((o) => o.id)).toEqual(['o_ligada', 'o_nova_local', 'Z']);
    expect(r.orientacoes[0]).toMatchObject({ texto: 'API X', concluida: true, inicio: '2026-08-15', medicamento_id: 'm1' });
    expect(r.orientacoes[2]).toMatchObject({ medicamento_id: 'm1', validade: '2026-11-01' });
    expect(r.idsOri).toEqual({ o_ligada: 'X', Z: 'Z' });
  });
});
