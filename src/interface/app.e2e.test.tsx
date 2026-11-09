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

  digitar('E-mail', 'joao@email.com');
  digitar('Senha', 'errada123');
  clicar('Entrar');
  await veTexto('Senha incorreta. Tente de novo.');
  digitar('Senha', 'senha1234');
  clicar('Entrar');
  await veTexto(/Hoje, 12 de outubro/);
});
