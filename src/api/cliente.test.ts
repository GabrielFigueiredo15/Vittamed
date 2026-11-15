// Testes do cliente da API: token, renovação, erros e mensagens.
import { criarApiFalsa, type ApiFalsa } from './apiFalsa';
import { aoExpirarSessao, definirFetch, ErroApi, requisitar } from './cliente';
import { lerPerfil, login, mensagemErro, registrar, salvarPerfil } from './auth';
import { carregarSessao, guardarSessao, limparSessao, sessaoAtual } from './sessao';

let api: ApiFalsa;

beforeEach(async () => {
  api = criarApiFalsa();
  definirFetch(api.fetch);
  await limparSessao();
});

afterAll(() => definirFetch(null));

test('login guarda a sessão e envia o Bearer nas rotas protegidas', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  const sessao = await login('maria@ex.com', 'Senha12345');

  expect(sessao.email).toBe('maria@ex.com');
  expect(await lerPerfil()).toMatchObject({ nome: 'Maria' });
  const ultima = api.chamadas[api.chamadas.length - 1];
  expect(ultima).toMatchObject({ metodo: 'GET', caminho: '/perfil', token: sessao.idToken });
});

test('a sessão salva é recuperada ao abrir o app de novo', async () => {
  api.criarConta('maria@ex.com', 'Senha12345');
  const sessao = await login('maria@ex.com', 'Senha12345');
  expect(await carregarSessao()).toEqual(sessao);
});

test('perfil inexistente devolve null (404)', async () => {
  await registrar('novo@ex.com', 'Senha12345');
  expect(await lerPerfil()).toBeNull();
  await salvarPerfil({ nome: 'Novo', telefone: '(11) 99999-1234' });
  expect(await lerPerfil()).toMatchObject({ nome: 'Novo', telefone: '(11) 99999-1234' });
});

test('token perto de vencer é renovado antes da chamada', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  const sessao = await login('maria@ex.com', 'Senha12345');
  await guardarSessao({ ...sessao, expiraEm: Date.now() + 10_000 });

  await lerPerfil();
  const caminhos = api.chamadas.map((c) => c.caminho);
  expect(caminhos.slice(-2)).toEqual(['/auth/refresh', '/perfil']);
  // O refresh devolve uid vazio: o uid e o e-mail anteriores são mantidos
  expect(sessaoAtual()).toMatchObject({ uid: sessao.uid, email: 'maria@ex.com' });
  expect(sessaoAtual()!.idToken).not.toBe(sessao.idToken);
});

test('401 numa rota protegida renova o token e repete a chamada uma vez', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  await login('maria@ex.com', 'Senha12345');
  api.invalidarTokens();

  expect(await lerPerfil()).toMatchObject({ nome: 'Maria' });
  expect(api.chamadas.filter((c) => c.caminho === '/perfil')).toHaveLength(2);
});

test('várias chamadas com token vencido fazem um único refresh', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  const sessao = await login('maria@ex.com', 'Senha12345');
  await guardarSessao({ ...sessao, expiraEm: Date.now() - 1 });

  await Promise.all([lerPerfil(), lerPerfil(), lerPerfil()]);
  expect(api.chamadas.filter((c) => c.caminho === '/auth/refresh')).toHaveLength(1);
});

test('refresh recusado encerra a sessão e avisa o app', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  await login('maria@ex.com', 'Senha12345');
  api.invalidarTokens();
  api.invalidarRefresh();

  const aviso = jest.fn();
  const parar = aoExpirarSessao(aviso);
  await expect(lerPerfil()).rejects.toMatchObject({ tipo: 'nao_autorizado' });
  parar();

  expect(aviso).toHaveBeenCalledTimes(1);
  expect(sessaoAtual()).toBeNull();
});

test('sem internet: erro sem_conexao e a sessão continua guardada', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  await login('maria@ex.com', 'Senha12345');
  api.offline = true;

  await expect(lerPerfil()).rejects.toMatchObject({ tipo: 'sem_conexao' });
  expect(sessaoAtual()).not.toBeNull();
});

test('modo manutenção vira erro "pausado"', async () => {
  api.pausado = true;
  await expect(requisitar('POST', '/auth/login', { corpo: {}, autenticado: false }))
    .rejects.toMatchObject({ tipo: 'pausado', status: 503 });
});

test('rota protegida sem login nem chama a API', async () => {
  await expect(lerPerfil()).rejects.toMatchObject({ tipo: 'nao_autorizado' });
  expect(api.chamadas).toHaveLength(0);
});

test('mensagens de erro em linguagem simples', async () => {
  api.criarConta('maria@ex.com', 'Senha12345');

  const senhaErrada = await login('maria@ex.com', 'outra').catch((e) => e);
  expect(mensagemErro(senhaErrada, 'login')).toBe('E-mail ou senha incorretos.');

  const repetido = await registrar('maria@ex.com', 'Senha12345').catch((e) => e);
  expect(mensagemErro(repetido, 'registrar')).toBe('Já existe uma conta com este e-mail. Toque em "Entrar".');

  expect(mensagemErro(new ErroApi('sem_conexao', 0, 'x'))).toMatch(/Sem conexão/);
  expect(mensagemErro(new Error('qualquer'))).toBe('Algo deu errado. Tente de novo.');
});
