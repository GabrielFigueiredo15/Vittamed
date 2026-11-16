// Testes da criação dos canais do Android com o módulo nativo simulado.

const canais = new Map<string, Record<string, unknown>>();
const recusarSomNulo = { valor: false };

const setNotificationChannelAsync = jest.fn(async (id: string, opcoes: Record<string, unknown>) => {
  // Imita o Expo Go no Android: NullPointerException com "sound: null"
  if (recusarSomNulo.valor && 'sound' in opcoes && opcoes.sound === null) {
    throw new Error("Call to function 'ExpoNotificationChannelManager.setNotificationChannelAsync' has been rejected.");
  }
  canais.set(id, opcoes);
  return null;
});

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('./expoNotifications.native', () => ({
  obterNotificacoes: () => ({
    setNotificationHandler: () => {},
    setNotificationChannelAsync,
    setNotificationCategoryAsync: async () => null,
    getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    AndroidImportance: { LOW: 2, HIGH: 4 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
  }),
}));

import { pedirPermissao } from './configuracao.native';

beforeEach(() => {
  canais.clear();
  recusarSomNulo.valor = false;
  setNotificationChannelAsync.mockClear();
});

test('cria os cinco canais; os canais sem som usam sound: null', async () => {
  expect(await pedirPermissao()).toBe('concedida');
  expect([...canais.keys()].sort()).toEqual(['doses', 'doses_som', 'doses_vibracao', 'doses_visual', 'familia']);
  expect(canais.get('doses_visual')).toMatchObject({ sound: null, importance: 4 });
});

test('Expo Go recusa sound: null: usa importância baixa e não quebra', async () => {
  recusarSomNulo.valor = true;
  expect(await pedirPermissao()).toBe('concedida');
  expect(canais.size).toBe(5);
  expect(canais.get('doses_visual')).toMatchObject({ importance: 2 });
  expect(canais.get('doses_visual')).not.toHaveProperty('sound');
  expect(canais.get('doses_vibracao')).toMatchObject({ importance: 2, vibrationPattern: [0, 400, 200, 400] });
});
