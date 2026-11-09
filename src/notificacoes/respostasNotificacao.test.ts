import type { NotificationResponse } from 'expo-notifications';
import { ACAO_ADIAR, ACAO_NAO_TOMEI, ACAO_TOMEI, CATEGORIA_DOSE } from './constantes';

const mockRemove = jest.fn();
const mockSetCategory = jest.fn<Promise<unknown>, [string, unknown[]]>();
const mockAddListener = jest.fn<
  { remove: () => void },
  [(resposta: NotificationResponse) => void]
>();
const mockGetLastResponse = jest.fn<Promise<NotificationResponse | null>, []>();
const mockClearLastResponse = jest.fn<Promise<void>, []>();

jest.mock('./expoNotifications.native', () => ({
  obterNotificacoes: () => ({
    setNotificationCategoryAsync: mockSetCategory,
    addNotificationResponseReceivedListener: mockAddListener,
    getLastNotificationResponseAsync: mockGetLastResponse,
    clearLastNotificationResponseAsync: mockClearLastResponse,
  }),
}));

import {
  ouvirRespostasNotificacao,
  registrarAcoesNotificacao,
} from './respostasNotificacao.native';

function criarResposta(acao: string): NotificationResponse {
  return {
    actionIdentifier: acao,
    notification: {
      date: 123,
      request: {
        identifier: 'dose-123',
        content: {
          title: 'Hora do remédio',
          body: 'Tome Losartana',
          data: { tipo: 'dose', medicamentoId: 'med-1' },
        },
      },
    },
  } as unknown as NotificationResponse;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetCategory.mockResolvedValue({});
  mockAddListener.mockImplementation(() => ({ remove: mockRemove }));
  mockGetLastResponse.mockResolvedValue(null);
  mockClearLastResponse.mockResolvedValue();
});

test('registra os três botões da categoria de doses', async () => {
  await registrarAcoesNotificacao();

  expect(mockSetCategory).toHaveBeenCalledWith(
    CATEGORIA_DOSE,
    expect.arrayContaining([
      expect.objectContaining({ identifier: ACAO_TOMEI, buttonTitle: 'Tomei' }),
      expect.objectContaining({ identifier: ACAO_ADIAR, buttonTitle: 'Adiar' }),
      expect.objectContaining({ identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei' }),
    ])
  );
});

test('envia para o app a resposta recebida do listener e remove a inscrição', async () => {
  let receber: ((resposta: NotificationResponse) => void) | undefined;
  mockAddListener.mockImplementation((callback) => {
    receber = callback;
    return { remove: mockRemove };
  });
  const listener = jest.fn();
  const remover = ouvirRespostasNotificacao(listener);
  const resposta = criarResposta(ACAO_TOMEI);

  receber?.(resposta);
  await Promise.resolve();

  expect(listener).toHaveBeenCalledWith({
    actionIdentifier: ACAO_TOMEI,
    identifier: 'dose-123',
    titulo: 'Hora do remédio',
    corpo: 'Tome Losartana',
    dados: { tipo: 'dose', medicamentoId: 'med-1' },
  });

  remover();
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

test('recupera a resposta de abertura a frio e evita despachar duplicado', async () => {
  const resposta = criarResposta(ACAO_ADIAR);
  mockGetLastResponse.mockResolvedValue(resposta);
  const listener = jest.fn();
  const remover = ouvirRespostasNotificacao(listener);

  await Promise.resolve();
  await Promise.resolve();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({
    actionIdentifier: ACAO_ADIAR,
    identifier: 'dose-123',
  }));
  expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
  remover();
});
