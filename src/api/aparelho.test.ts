// Testes do registro do aparelho para o aviso à família (RF09).
import { criarApiFalsa, type ApiFalsa } from './apiFalsa';
import { definirFetch } from './cliente';
import { login } from './auth';
import { limparSessao } from './sessao';
import { desregistrarAparelho, registrarAparelho } from './aparelho';
import type { ResultadoToken } from '../notificacoes/push';

// O token de push vem do aparelho; aqui é simulado
let token: ResultadoToken = { ok: true, token: 'ExponentPushToken[abc]', plataforma: 'android' };
jest.mock('../notificacoes/push', () => ({
  obterTokenPush: jest.fn(async () => token),
  ouvirTrocaToken: () => () => {},
}));

let api: ApiFalsa;
const puts = () => api.chamadas.filter((c) => c.metodo === 'PUT' && c.caminho === '/aparelhos');

beforeEach(async () => {
  api = criarApiFalsa();
  definirFetch(api.fetch);
  await limparSessao();
  await desregistrarAparelho(); // zera o registro local entre os testes
  api.chamadas.length = 0;
  token = { ok: true, token: 'ExponentPushToken[abc]', plataforma: 'android' };
  api.criarConta('maria@ex.com', 'Senha12345');
  api.criarConta('joao@ex.com', 'Senha12345');
});

afterAll(() => definirFetch(null));

test('registra o token na conta logada', async () => {
  const sessao = await login('maria@ex.com', 'Senha12345');
  expect(await registrarAparelho()).toBe('registrado');
  expect(api.aparelhos.get('ExponentPushToken[abc]')).toEqual({ uid: sessao.uid, plataforma: 'android' });
});

test('não reenvia se nada mudou; reenvia se o token mudou', async () => {
  await login('maria@ex.com', 'Senha12345');
  await registrarAparelho();
  expect(await registrarAparelho()).toBe('ja_registrado');
  expect(puts()).toHaveLength(1);

  token = { ok: true, token: 'ExponentPushToken[novo]', plataforma: 'android' };
  expect(await registrarAparelho()).toBe('registrado');
  expect(puts()).toHaveLength(2);
});

test('outra conta no mesmo aparelho registra de novo (o token muda de dono)', async () => {
  await login('maria@ex.com', 'Senha12345');
  await registrarAparelho();
  const joao = await login('joao@ex.com', 'Senha12345');
  expect(await registrarAparelho()).toBe('registrado');
  expect(api.aparelhos.get('ExponentPushToken[abc]')!.uid).toBe(joao.uid);
});

test('backend ainda sem o endpoint: fica pendente e registra quando ele existir', async () => {
  api.comAparelhos = false;
  await login('maria@ex.com', 'Senha12345');
  expect(await registrarAparelho()).toBe('pendente');

  api.comAparelhos = true;
  expect(await registrarAparelho()).toBe('registrado');
});

test('sem internet fica pendente', async () => {
  await login('maria@ex.com', 'Senha12345');
  api.offline = true;
  expect(await registrarAparelho()).toBe('pendente');
});

test('sem token (ex.: Expo Go, sem permissão) não chama a API', async () => {
  await login('maria@ex.com', 'Senha12345');
  token = { ok: false, motivo: 'sem_permissao' };
  expect(await registrarAparelho()).toBe('sem_permissao');
  expect(puts()).toHaveLength(0);
});

test('sem login não chama a API', async () => {
  expect(await registrarAparelho()).toBe('pendente');
  expect(api.chamadas).toHaveLength(0);
});

test('ao sair, remove o aparelho da conta', async () => {
  await login('maria@ex.com', 'Senha12345');
  await registrarAparelho();
  await desregistrarAparelho();
  expect(api.aparelhos.size).toBe(0);

  // Ao entrar de novo, registra outra vez
  expect(await registrarAparelho()).toBe('registrado');
});
