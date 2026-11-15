// Testes do assistente de IA: chamada ao POST /chat e mensagens de erro.
import { criarApiFalsa, type ApiFalsa } from './apiFalsa';
import { definirFetch, ErroApi } from './cliente';
import { login } from './auth';
import { limparSessao } from './sessao';
import { LIMITE_HISTORICO, mensagemErroIA, montarMensagens, perguntarIA, type MensagemChat } from './chat';

let api: ApiFalsa;

beforeEach(async () => {
  api = criarApiFalsa();
  definirFetch(api.fetch);
  await limparSessao();
  api.criarConta('maria@ex.com', 'Senha12345');
  await login('maria@ex.com', 'Senha12345');
});

afterAll(() => definirFetch(null));

const ultimaChamada = () => api.chamadas[api.chamadas.length - 1];

test('envia histórico, contexto e Bearer para o /chat e devolve a resposta', async () => {
  api.respostaChat = '  A losartana serve para controlar a pressão.  ';
  const historico: MensagemChat[] = [
    { role: 'user', content: 'Oi' },
    { role: 'assistant', content: 'Olá! Como posso ajudar?' },
  ];

  const resposta = await perguntarIA(historico, 'Para que serve a losartana?', 'Remédios: Losartana 50 mg', 'Losartana');

  expect(resposta).toBe('A losartana serve para controlar a pressão.');
  const chamada = ultimaChamada();
  expect(chamada).toMatchObject({ metodo: 'POST', caminho: '/chat' });
  expect(chamada.token).toBeTruthy();
  expect(chamada.corpo).toMatchObject({ remedio: 'Losartana', rag: true, stream: false });
  const mensagens = (chamada.corpo as { mensagens: MensagemChat[] }).mensagens;
  expect(mensagens).toHaveLength(3);
  expect(mensagens[2]).toEqual({
    role: 'user',
    content: 'Remédios: Losartana 50 mg\n\nPergunta: Para que serve a losartana?',
  });
  expect(mensagens.some((m) => (m.role as string) === 'system')).toBe(false);
});

test('sem remédio citado não pede a busca da bula', async () => {
  await perguntarIA([], 'Como organizo meus remédios?', 'contexto');
  expect(ultimaChamada().corpo).toMatchObject({ remedio: null, rag: false });
});

test('histórico longo é cortado e sempre começa com pergunta', () => {
  const historico: MensagemChat[] = Array.from({ length: 15 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i}`,
  }));
  const mensagens = montarMensagens(historico, 'nova', 'ctx');
  expect(mensagens.length).toBeLessThanOrEqual(LIMITE_HISTORICO + 1);
  expect(mensagens[0].role).toBe('user');
  expect(mensagens[mensagens.length - 1].content).toBe('ctx\n\nPergunta: nova');
});

test('IA fora do ar (502) vira mensagem de indisponível', async () => {
  api.respostaChat = null;
  const erro = await perguntarIA([], 'Oi', 'ctx').catch((e) => e);
  expect(erro).toBeInstanceOf(ErroApi);
  expect(mensagemErroIA(erro)).toMatch(/indisponível/);
});

test('sem internet explica que só responde sobre os dados cadastrados', async () => {
  api.offline = true;
  const erro = await perguntarIA([], 'Oi', 'ctx').catch((e) => e);
  expect(mensagemErroIA(erro)).toMatch(/Sem internet/);
});

test('resposta vazia da IA é tratada como erro', async () => {
  api.respostaChat = '   ';
  const erro = await perguntarIA([], 'Oi', 'ctx').catch((e) => e);
  expect(mensagemErroIA(erro)).toBe('Não consegui responder agora. Tente de novo.');
});

test('sessão expirada pede para entrar de novo', () => {
  expect(mensagemErroIA(new ErroApi('nao_autorizado', 401, 'x'))).toMatch(/Entre de novo/);
});
