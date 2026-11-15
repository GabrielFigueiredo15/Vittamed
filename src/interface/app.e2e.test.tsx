/**
 * @jest-environment jsdom
 */
// Teste de ponta a ponta: renderiza o app inteiro (react-native-web) e percorre
// os fluxos principais: conta, remédio, dose, orientação, notificações e perfil.
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Na web a foto vem do seletor de arquivos do navegador; aqui devolvemos uma imagem fixa
jest.mock('./foto', () => ({
  escolherFoto: async () => ({ uri: 'data:image/jpeg;base64,AAAA' }),
}));

import App from '../App';
import { cancelarTodas, dispararToque, listarAgendadas } from '../notificacoes/notificador';
import { criarApiFalsa, type ApiFalsa } from '../api/apiFalsa';
import { definirFetch } from '../api/cliente';
import { limparSessao, sessaoAtual } from '../api/sessao';

// O app fala com a API; nos testes ela é simulada em memória
let api: ApiFalsa;

const HOJE_10H = new Date(2026, 9, 12, 10, 0); // segunda, 12/10/2026 10:00

const idsAgendados = (prefixo: string): string[] =>
  listarAgendadas().map((n) => n.identifier).filter((id) => id.startsWith(prefixo));

// Pressable do react-native-web vira <div role="button" aria-label=...>
const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome });
const clicar = (nome: string | RegExp) => fireEvent.click(botao(nome));
const aba = (nome: string) => fireEvent.click(screen.getByRole('tab', { name: nome }));
const digitar = (rotulo: string, texto: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: texto } });
const veTexto = async (texto: string | RegExp) => screen.findAllByText(texto);
const estadoSalvo = () => JSON.parse(window.localStorage.getItem('@vittamed_estado') as string);

beforeEach(() => {
  // Só o relógio é falso; os timers reais continuam para o waitFor funcionar
  jest.useFakeTimers({
    now: HOJE_10H,
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
      'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'performance', 'hrtime',
    ],
  });
  window.localStorage.clear();
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  cancelarTodas();
  api = criarApiFalsa();
  definirFetch(api.fetch);
  return limparSessao();
});

afterEach(() => {
  cleanup();
  cancelarTodas();
  jest.useRealTimers();
});

async function criarContaEEntrar() {
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  clicar('Criar conta');

  digitar('E-mail', 'joao@email.com');
  digitar('Criar senha', 'senha1234');
  digitar('Confirmar senha', 'senha1234');
  fireEvent.click(screen.getByRole('checkbox'));
  clicar('Criar conta');

  await veTexto('Completar perfil');
  digitar('Nome completo', 'João Silva');
  digitar('Número de celular', '11999991234');
  digitar('Data de nascimento', '05031954');
  expect((screen.getByLabelText('Idade') as HTMLInputElement).value).toBe('72 anos');
  clicar('Masculino');
  clicar('Concluir perfil');

  await veTexto(/Hoje, 12 de outubro/);
}

async function cadastrarMedicamento(nome: string, hora: string) {
  aba('Remédios');
  await veTexto('Meus remédios');
  clicar('+ Adicionar remédio');
  await veTexto('Dados do remédio');
  digitar('Nome', nome);
  digitar('Dosagem', '50 mg');
  clicar('Continuar para programação');
  await veTexto('Programar remédio');
  digitar('Horário 1', hora);
  clicar('Salvar remédio');
  await veTexto('Meus remédios');
}

test('cria a conta, completa o perfil e abre o início', async () => {
  await criarContaEEntrar();
  expect(screen.getByText('João')).toBeTruthy();
  expect(screen.getByText('Nenhum remédio cadastrado')).toBeTruthy();
});

test('valida senha curta, senhas diferentes e termos', async () => {
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  clicar('Criar conta');
  digitar('E-mail', 'a@b.com');
  digitar('Criar senha', '123');
  digitar('Confirmar senha', '456');
  clicar('Criar conta');
  expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy();
  expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();
  expect(screen.getByText('Aceite os termos para continuar.')).toBeTruthy();
});

test('remédio salvo aparece na lista e no início, com lembretes agendados', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');

  expect((await veTexto('Losartana 50 mg')).length).toBeGreaterThan(0);
  // Microtarefa 11: salvar reagenda (hoje 12:00 e os dois dias seguintes)
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(3));

  aba('Início');
  await veTexto(/Próxima dose · 12:00/);
});

test('marcar como tomado atualiza o início e cancela o lembrete daquela dose', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(3));

  aba('Início');
  await veTexto(/Próxima dose · 12:00/);
  clicar('✓ Marcar como tomado');

  await veTexto('✓ Tomado');
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(2));
  const ts = new Date(2026, 9, 12, 12, 0).getTime();
  expect(idsAgendados('dose_').some((id) => id.endsWith(`_${ts}`))).toBe(false);
});

test('adiar uma dose agenda um novo lembrete no horário escolhido', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Metformina', '12:00');

  aba('Início');
  await veTexto(/Próxima dose · 12:00/);
  clicar(/Metformina às 12:00/);
  await veTexto('Hora do remédio');
  clicar('Adiar');
  digitar('Novo horário', '12:30');
  clicar('Confirmar adiamento');

  await veTexto(/Hoje, 12 de outubro/);
  await veTexto('Adiada para 12:30');
  await waitFor(() => expect(idsAgendados('adiada_').length).toBe(1));
  const [adiada] = listarAgendadas().filter((n) => n.identifier.startsWith('adiada_'));
  expect(adiada.quando).toEqual(new Date(2026, 9, 12, 12, 30));
});

test('tocar na notificação abre a dose e o botão "Não tomei" registra', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(3));

  const medId = estadoSalvo().medicamentos[0].id as string;
  const horario = new Date(2026, 9, 12, 12, 0).toISOString();

  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }));
  await veTexto('Hora do remédio');
  expect(screen.getByText(/Confirme se você tomou/)).toBeTruthy();

  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }, 'nao_tomei'));
  await veTexto(/Hoje, 12 de outubro/);
  await veTexto('Não tomado');
});

test('orientação vencida avisa todo dia e excluir cancela os avisos', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');

  clicar('Detalhes');
  await veTexto('Detalhes do remédio');
  clicar('Orientações de uso');
  await veTexto('Associadas a Losartana 50 mg');
  clicar('Adicionar orientação');
  await veTexto('Dados da orientação');
  digitar('Texto da orientação', 'Conferir a receita com o farmacêutico');
  digitar('Início da validade', '01/09/2026');
  digitar('Fim da validade', '01/10/2026');
  clicar('Salvar orientação / alterações');

  await veTexto('Revisão pendente · Continua ativa');
  await waitFor(() => expect(idsAgendados('orientacao_').length).toBe(3));

  // Visualizar abre só leitura; Editar libera os campos
  clicar('Visualizar');
  await veTexto('Visualizando a orientação.');
  expect((screen.getByLabelText('Texto da orientação') as HTMLTextAreaElement).readOnly).toBe(true);
  clicar('Editar');
  expect((screen.getByLabelText('Texto da orientação') as HTMLTextAreaElement).readOnly).toBe(false);
  clicar(/Voltar para Orientações de uso/);
  await veTexto('Associadas a Losartana 50 mg');

  clicar('Excluir');
  await veTexto('Ao excluir • confirmação');
  clicar('Confirmar exclusão');
  await waitFor(() => expect(idsAgendados('orientacao_').length).toBe(0));
  await veTexto('Nenhuma orientação cadastrada.');
});

test('excluir o remédio pede confirmação na tela e cancela os lembretes', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(3));

  clicar('Excluir');
  const aviso = await screen.findByRole('alert');
  expect(within(aviso).getByText(/Remover o medicamento encerra seus lembretes/)).toBeTruthy();
  fireEvent.click(within(aviso).getByRole('button', { name: 'Excluir medicamento' }));

  await veTexto(/Nenhum remédio ainda/);
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(0));
});

test('desligar os lembretes no perfil cancela tudo', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(3));

  aba('Perfil');
  await veTexto('Meu perfil');
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(0));
});

test('assistente responde com os remédios cadastrados e recusa dúvida clínica', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  aba('Início');
  clicar('Abrir assistente de IA');
  await veTexto('Assistente de IA');

  digitar('Digite sua dúvida', 'Qual é a próxima dose?');
  clicar('Enviar');
  await veTexto(/Sua próxima dose é Losartana 50 mg/);

  digitar('Digite sua dúvida', 'Posso tomar com álcool?');
  clicar('Enviar');
  await veTexto(/Para dúvidas sobre dose, interações/);

  // Respondidas no aparelho: nada vai para a IA
  expect(api.chamadas.some((c) => c.caminho === '/chat')).toBe(false);
});

test('assistente manda perguntas gerais para a IA com os remédios cadastrados', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  aba('Início');
  clicar('Abrir assistente de IA');
  await veTexto('Assistente de IA');

  api.respostaChat = 'A losartana é usada para controlar a pressão alta.';
  digitar('Digite sua dúvida', 'Para que serve a losartana?');
  clicar('Enviar');
  await veTexto('A losartana é usada para controlar a pressão alta.');

  const chamada = api.chamadas.find((c) => c.caminho === '/chat')!;
  const corpo = chamada.corpo as { remedio: string; mensagens: { role: string; content: string }[] };
  expect(corpo.remedio).toBe('Losartana');
  expect(corpo.mensagens[corpo.mensagens.length - 1].content).toMatch(/Losartana.*\n\nPergunta: Para que serve a losartana\?/s);

  // A segunda pergunta leva a conversa anterior
  api.respostaChat = 'Guarde em local seco, longe do calor.';
  digitar('Digite sua dúvida', 'E como guardar?');
  clicar('Enviar');
  await veTexto('Guarde em local seco, longe do calor.');
  const ultima = api.chamadas.filter((c) => c.caminho === '/chat').pop()!;
  const msgs = (ultima.corpo as { mensagens: { role: string; content: string }[] }).mensagens;
  expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(msgs[1].content).toBe('A losartana é usada para controlar a pressão alta.');
});

test('assistente avisa quando a IA está fora do ar ou sem internet', async () => {
  await criarContaEEntrar();
  aba('Início');
  clicar('Abrir assistente de IA');
  await veTexto('Assistente de IA');

  api.respostaChat = null;
  digitar('Digite sua dúvida', 'Como organizar a caixa de remédios?');
  clicar('Enviar');
  await veTexto(/O assistente está indisponível no momento/);

  api.offline = true;
  digitar('Digite sua dúvida', 'Como organizar a caixa de remédios?');
  clicar('Enviar');
  await veTexto(/Sem internet agora/);

  // Sem internet, as perguntas sobre os dados continuam funcionando
  digitar('Digite sua dúvida', 'Quais remédios tenho cadastrados?');
  clicar('Enviar');
  await veTexto('Você ainda não tem remédios cadastrados.');
});

test('foto do remédio aparece nos detalhes e foto do perfil é salva', async () => {
  await criarContaEEntrar();

  aba('Remédios');
  clicar('+ Adicionar remédio');
  await veTexto('Dados do remédio');
  digitar('Nome', 'Vitamina D');
  clicar('Adicionar / trocar foto');
  await waitFor(() => expect(screen.getByLabelText('Foto da embalagem')).toBeTruthy());
  clicar('Continuar para programação');
  await veTexto('Programar remédio');
  digitar('Horário 1', '20:00');
  clicar('Salvar remédio');
  await veTexto('Meus remédios');
  clicar('Detalhes');
  await veTexto('Detalhes do remédio');
  expect(screen.getByLabelText('Foto da embalagem')).toBeTruthy();

  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Minha conta');
  await veTexto('Minha conta');
  clicar('Adicionar foto');
  await waitFor(() => expect(screen.getByLabelText('Foto de João Silva')).toBeTruthy());
  clicar('Salvar alterações');
  await veTexto('Meu perfil');
  expect(estadoSalvo().usuario.foto).toContain('data:image/jpeg;base64,AAAA');
});

test('tema escuro e tamanho do texto ficam salvos', async () => {
  await criarContaEEntrar();
  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Escuro');
  await waitFor(() => expect(estadoSalvo().prefs.tema).toBe('escuro'));

  clicar('Tamanho do texto');
  await veTexto('Acessibilidade e lembretes');
  fireEvent.click(screen.getByRole('radio', { name: /Grande/ }));
  fireEvent.click(screen.getByRole('radio', { name: /Vibração ativada/ }));
  clicar('Salvar preferências');
  await waitFor(() => expect(estadoSalvo().prefs).toMatchObject({ tamanho: 'grande', formato: 'vibracao' }));
});

test('sair da conta volta ao login e a senha errada é recusada', async () => {
  await criarContaEEntrar();
  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Sair da conta');
  await veTexto('Bem-vindo de volta!');

  expect(sessaoAtual()).toBeNull(); // tokens descartados

  digitar('E-mail', 'joao@email.com');
  digitar('Senha', 'errada123');
  clicar('Entrar');
  await veTexto('E-mail ou senha incorretos.');
  digitar('Senha', 'senha1234');
  clicar('Entrar');
  await veTexto(/Hoje, 12 de outubro/);
});

// ---------- Login pela API ----------

async function entrarCom(email: string, senha: string, lembrar = true) {
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  digitar('E-mail', email);
  digitar('Senha', senha);
  if (!lembrar) fireEvent.click(screen.getByRole('checkbox'));
  clicar('Entrar');
}

test('cadastro cria a conta e o perfil na API, sem guardar a senha no aparelho', async () => {
  await criarContaEEntrar();

  const uid = api.contas.get('joao@email.com')!.uid;
  expect(api.perfis.get(uid)).toMatchObject({
    nome: 'João Silva',
    telefone: '(11) 99999-1234',
    data_nascimento: '1954-03-05',
    email: 'joao@email.com',
  });
  expect(estadoSalvo().uid).toBe(uid);
  expect(estadoSalvo().usuario.senha).toBeUndefined();
  expect(window.localStorage.getItem('@vittamed_sessao_api')).not.toContain('senha1234');
});

test('entra num aparelho novo e traz o perfil da API', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria Souza', telefone: '(21) 98888-7777' });
  await entrarCom('maria@ex.com', 'Senha12345');
  await veTexto(/Hoje, 12 de outubro/);
  expect(screen.getByText('Maria')).toBeTruthy();
  expect(estadoSalvo().usuario).toMatchObject({ nome: 'Maria Souza', celular: '(21) 98888-7777' });
});

test('e-mail já cadastrado avisa na etapa 1 do cadastro', async () => {
  api.criarConta('joao@email.com', 'outraSenha1');
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  clicar('Criar conta');
  digitar('E-mail', 'joao@email.com');
  digitar('Criar senha', 'senha1234');
  digitar('Confirmar senha', 'senha1234');
  fireEvent.click(screen.getByRole('checkbox'));
  clicar('Criar conta');
  await veTexto('Já existe uma conta com este e-mail. Toque em "Entrar".');
  expect(screen.queryByText('Completar perfil')).toBeNull();
});

test('conta sem perfil vai para "Completar perfil" depois do login', async () => {
  api.criarConta('sem@perfil.com', 'Senha12345');
  await entrarCom('sem@perfil.com', 'Senha12345');
  await veTexto('Completar perfil');

  digitar('Nome completo', 'Ana Lima');
  digitar('Número de celular', '11988887777');
  digitar('Data de nascimento', '10101950');
  clicar('Feminino');
  clicar('Concluir perfil');
  await veTexto(/Hoje, 12 de outubro/);
  expect(api.perfis.get(api.contas.get('sem@perfil.com')!.uid)).toMatchObject({ nome: 'Ana Lima' });
});

test('sem internet o login mostra um aviso claro', async () => {
  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  api.offline = true;
  await entrarCom('maria@ex.com', 'Senha12345');
  await veTexto(/Sem conexão com a internet/);
});

test('com "Lembrar de mim" o app abre já logado; sem ele, volta ao login', async () => {
  await criarContaEEntrar();
  cleanup();
  render(<App />);
  await veTexto(/Hoje, 12 de outubro/);

  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Sair da conta');
  await veTexto('Bem-vindo de volta!');
  cleanup();

  await entrarCom('joao@email.com', 'senha1234', false);
  await veTexto(/Hoje, 12 de outubro/);
  cleanup();
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  expect(sessaoAtual()).toBeNull();
});

test('outra conta no mesmo aparelho não vê os remédios da anterior', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '20:00');
  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Sair da conta');
  await veTexto('Bem-vindo de volta!');
  cleanup();

  api.criarConta('maria@ex.com', 'Senha12345', { nome: 'Maria' });
  await entrarCom('maria@ex.com', 'Senha12345');
  await veTexto(/Hoje, 12 de outubro/);
  expect(estadoSalvo().medicamentos).toEqual([]);
});

test('a mesma conta, ao entrar de novo, mantém os remédios locais', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '20:00');
  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Sair da conta');
  await veTexto('Bem-vindo de volta!');

  digitar('E-mail', 'joao@email.com');
  digitar('Senha', 'senha1234');
  clicar('Entrar');
  await veTexto(/Hoje, 12 de outubro/);
  expect(estadoSalvo().medicamentos.map((m: { nome: string }) => m.nome)).toEqual(['Losartana']);
});

test('estado antigo do protótipo (com senha salva) pede login e descarta a senha', async () => {
  window.localStorage.setItem('@vittamed_estado', JSON.stringify({
    usuario: { email: 'joao@email.com', senha: 'senha1234', nome: 'João', celular: '', nascimento: '', genero: '' },
    sessao: true,
    lembrar: true,
  }));
  render(<App />);
  await veTexto('Bem-vindo de volta!');
  await waitFor(() => expect(estadoSalvo().usuario.senha).toBeUndefined());
});

test('sessão expirada na API volta para o login', async () => {
  await criarContaEEntrar();
  api.invalidarTokens();
  api.invalidarRefresh();

  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Minha conta');
  await veTexto('Minha conta');
  digitar('Nome completo', 'João S. Silva');
  clicar('Salvar alterações');
  await veTexto('Bem-vindo de volta!');
});

test('editar o perfil atualiza a API', async () => {
  await criarContaEEntrar();
  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Minha conta');
  await veTexto('Minha conta');
  digitar('Nome completo', 'João S. Silva');
  clicar('Salvar alterações');
  await veTexto('Meu perfil');
  expect(api.perfis.get(api.contas.get('joao@email.com')!.uid)).toMatchObject({ nome: 'João S. Silva' });
});

// ---------- Remédios e doses na API ----------

const uidDe = (email: string) => api.contas.get(email)!.uid;
const medsNaApi = () => [...api.colecao(uidDe('joao@email.com'), 'medicamentos').values()];
const dosesNaApi = () => [...api.colecao(uidDe('joao@email.com'), 'doses').values()];
const filaSalva = () => JSON.parse(window.localStorage.getItem('@vittamed_sync_api') ?? '{"fila":[]}').fila;

test('cadastrar remédio e responder a notificação enviam para a API', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(medsNaApi()).toHaveLength(1));
  expect(medsNaApi()[0]).toMatchObject({
    nome: 'Losartana',
    dosagem: '50 mg',
    agendamento: { tipo: 'fixo', horarios: ['12:00'] },
  });

  const medId = estadoSalvo().medicamentos[0].id as string;
  const horario = new Date(2026, 9, 12, 12, 0).toISOString();
  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }, 'nao_tomei'));

  await waitFor(() => expect(dosesNaApi()).toHaveLength(1));
  expect(dosesNaApi()[0]).toMatchObject({
    medicamento_id: medsNaApi()[0].id,
    horario_previsto: horario,
    status: 'nao_tomada',
  });
  await waitFor(() => expect(dosesNaApi()[0].horario_registrado).toBeTruthy());
});

test('outro aparelho da mesma conta vê os remédios e as doses', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  const medId = estadoSalvo().medicamentos[0].id as string;
  const horario = new Date(2026, 9, 12, 12, 0).toISOString();
  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }, 'tomei'));
  await waitFor(() => expect(dosesNaApi()[0]?.status).toBe('tomada'));

  // Outro celular: nada salvo localmente
  cleanup();
  window.localStorage.clear();
  await limparSessao();
  cancelarTodas();

  await entrarCom('joao@email.com', 'senha1234');
  await veTexto(/Hoje, 12 de outubro/);
  await waitFor(() => expect(estadoSalvo().medicamentos.map((m: { nome: string }) => m.nome)).toEqual(['Losartana']));
  await waitFor(() => expect(estadoSalvo().registros).toHaveLength(1));
  expect(estadoSalvo().registros[0]).toMatchObject({ status: 'tomada', horario_previsto: horario });
  // A dose já tomada não deve tocar neste aparelho
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(2));
});

test('sem internet o cadastro fica na fila e é enviado quando o app abre de novo', async () => {
  await criarContaEEntrar();
  api.offline = true;
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(filaSalva()).toHaveLength(1));
  expect(medsNaApi()).toHaveLength(0);

  api.offline = false;
  cleanup();
  render(<App />);
  await veTexto(/Hoje, 12 de outubro/);
  await waitFor(() => expect(medsNaApi()).toHaveLength(1));
  await waitFor(() => expect(filaSalva()).toHaveLength(0));
});

test('excluir o remédio apaga na API', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(medsNaApi()).toHaveLength(1));

  clicar('Excluir');
  const aviso = await screen.findByRole('alert');
  fireEvent.click(within(aviso).getByRole('button', { name: 'Excluir medicamento' }));
  await waitFor(() => expect(medsNaApi()).toHaveLength(0));
});

test('remédio excluído em outro aparelho some daqui ao abrir o app', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(medsNaApi()).toHaveLength(1));

  api.colecao(uidDe('joao@email.com'), 'medicamentos').clear();
  cleanup();
  render(<App />);
  await veTexto(/Hoje, 12 de outubro/);
  await waitFor(() => expect(estadoSalvo().medicamentos).toEqual([]));
  await waitFor(() => expect(idsAgendados('dose_').length).toBe(0));
});

test('dados do protótipo (sem API) são enviados no primeiro login', async () => {
  api.criarConta('joao@email.com', 'senha1234', { nome: 'João Silva' });
  window.localStorage.setItem('@vittamed_estado', JSON.stringify({
    usuario: { email: 'joao@email.com', nome: 'João Silva', celular: '', nascimento: '', genero: '' },
    sessao: false,
    lembrar: true,
    medicamentos: [{
      id: 'm_antigo', nome: 'Metformina', ativo: true,
      agendamento: { tipo: 'fixo', horarios: ['08:00'] }, criado_em: '2026-10-01T10:00:00.000Z',
    }],
    registros: [],
    orientacoes: [],
  }));

  await entrarCom('joao@email.com', 'senha1234');
  await veTexto(/Hoje, 12 de outubro/);
  await waitFor(() => expect(medsNaApi().map((m) => m.nome)).toEqual(['Metformina']));
  // Continua com o id local (notificações e registros dependem dele)
  expect(estadoSalvo().medicamentos.map((m: { id: string }) => m.id)).toEqual(['m_antigo']);
});

test('adiar e depois tomar atualiza a mesma dose na API', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  const medId = estadoSalvo().medicamentos[0].id as string;
  const horario = new Date(2026, 9, 12, 12, 0).toISOString();

  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }, 'adiar'));
  await waitFor(() => expect(dosesNaApi()[0]?.status).toBe('adiada'));
  expect(dosesNaApi()[0].novo_horario).toBeTruthy();

  act(() => dispararToque({ tipo: 'dose', medicamentoId: medId, horarioPrevisto: horario }, 'tomei'));
  await waitFor(() => expect(dosesNaApi()[0]?.status).toBe('tomada'));
  expect(dosesNaApi()).toHaveLength(1);
});

// ---------- Orientações na API (RF12, RF14) ----------

const orientacoesNaApi = () => [...api.colecao(uidDe('joao@email.com'), 'orientacoes').values()];

async function criarOrientacaoVencida() {
  clicar('Detalhes');
  await veTexto('Detalhes do remédio');
  clicar('Orientações de uso');
  await veTexto('Associadas a Losartana 50 mg');
  clicar('Adicionar orientação');
  await veTexto('Dados da orientação');
  digitar('Texto da orientação', 'Conferir a receita com o farmacêutico');
  digitar('Início da validade', '01/09/2026');
  digitar('Fim da validade', '01/10/2026');
  clicar('Salvar orientação / alterações');
  await veTexto('Revisão pendente · Continua ativa');
}

test('orientação criada e concluída vai para a API', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await criarOrientacaoVencida();

  await waitFor(() => expect(orientacoesNaApi()).toHaveLength(1));
  expect(orientacoesNaApi()[0]).toMatchObject({
    medicamento_id: medsNaApi()[0].id,
    texto: 'Conferir a receita com o farmacêutico',
    validade: '2026-10-01',
    concluida: false,
  });

  clicar('Visualizar');
  await veTexto('Visualizando a orientação.');
  clicar('Concluir orientação');
  await waitFor(() => expect(orientacoesNaApi()[0].concluida).toBe(true));
  await waitFor(() => expect(idsAgendados('orientacao_').length).toBe(0));
});

test('outro aparelho recebe a orientação vencida e o lembrete diário dela', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await criarOrientacaoVencida();
  await waitFor(() => expect(orientacoesNaApi()).toHaveLength(1));

  cleanup();
  window.localStorage.clear();
  await limparSessao();
  cancelarTodas();

  await entrarCom('joao@email.com', 'senha1234');
  await veTexto(/Hoje, 12 de outubro/);
  await waitFor(() => expect(estadoSalvo().orientacoes).toHaveLength(1));
  expect(estadoSalvo().orientacoes[0]).toMatchObject({
    texto: 'Conferir a receita com o farmacêutico',
    medicamento_id: estadoSalvo().medicamentos[0].id,
  });
  await waitFor(() => expect(idsAgendados('orientacao_').length).toBeGreaterThan(0));
});

test('excluir o remédio apaga as orientações dele na API', async () => {
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await criarOrientacaoVencida();
  await waitFor(() => expect(orientacoesNaApi()).toHaveLength(1));

  aba('Remédios');
  await veTexto('Meus remédios');
  clicar('Excluir');
  const aviso = await screen.findByRole('alert');
  fireEvent.click(within(aviso).getByRole('button', { name: 'Excluir medicamento' }));
  await waitFor(() => expect(medsNaApi()).toHaveLength(0));
  expect(orientacoesNaApi()).toHaveLength(0);
});

// ---------- Aviso à família: token de push (RF09) ----------

// Na web não há push; aqui o token do aparelho é simulado quando o teste define
jest.mock('../notificacoes/push', () => ({
  obterTokenPush: async () =>
    (globalThis as { __tokenPushTeste?: unknown }).__tokenPushTeste ?? { ok: false, motivo: 'sem_suporte' },
  ouvirTrocaToken: () => () => {},
}));
const definirTokenPush = (valor: unknown) => {
  (globalThis as { __tokenPushTeste?: unknown }).__tokenPushTeste = valor;
};
afterEach(() => definirTokenPush(undefined));

test('entrar registra o aparelho na conta e sair remove', async () => {
  definirTokenPush({ ok: true, token: 'ExponentPushToken[celular-joao]', plataforma: 'android' });
  await criarContaEEntrar();
  await waitFor(() => expect(api.aparelhos.get('ExponentPushToken[celular-joao]')?.uid).toBe(uidDe('joao@email.com')));

  aba('Perfil');
  await veTexto('Meu perfil');
  clicar('Sair da conta');
  await veTexto('Bem-vindo de volta!');
  await waitFor(() => expect(api.aparelhos.size).toBe(0));
  await waitFor(() => expect(sessaoAtual()).toBeNull());
});

test('sem o endpoint no backend o app funciona normalmente', async () => {
  api.comAparelhos = false;
  definirTokenPush({ ok: true, token: 'ExponentPushToken[x]', plataforma: 'android' });
  await criarContaEEntrar();
  await cadastrarMedicamento('Losartana', '12:00');
  await waitFor(() => expect(medsNaApi()).toHaveLength(1));
  expect(api.chamadas.some((c) => c.caminho === '/aparelhos')).toBe(true);
});

test('tocar no aviso de dose não tomada abre os avisos do perfil', async () => {
  await criarContaEEntrar();
  act(() => dispararToque({ tipo: 'aviso_familia' }));
  await veTexto('Avisos do perfil compartilhado');
});
