// Testes de push.native.ts (token de push no Android/iOS) com os módulos nativos simulados.

const nativo = {
  appOwnership: null as string | null,
  expoGo: false,
  isDevice: true,
  granted: true,
  projectId: 'proj-123' as string | undefined,
  falhar: false,
  plataforma: 'android',
};

jest.mock('react-native', () => ({ Platform: { get OS() { return nativo.plataforma; } } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get appOwnership() { return nativo.appOwnership; },
    get expoConfig() { return { extra: { eas: { projectId: nativo.projectId } } }; },
    easConfig: null,
  },
}));
jest.mock('expo', () => ({ isRunningInExpoGo: () => nativo.expoGo }));
jest.mock('expo-device', () => ({ get isDevice() { return nativo.isDevice; } }));
const getExpoPushTokenAsync = jest.fn(async ({ projectId }: { projectId: string }) => {
  if (nativo.falhar) throw new Error('Default FirebaseApp is not initialized');
  return { type: 'expo', data: `ExponentPushToken[${projectId}]` };
});
const addPushTokenListener = jest.fn(() => ({ remove: () => {} }));
jest.mock('./expoNotifications.native', () => ({
  obterNotificacoes: () => ({
    getPermissionsAsync: async () => ({ granted: nativo.granted }),
    getExpoPushTokenAsync,
    addPushTokenListener,
  }),
}));

import { obterTokenPush, ouvirTrocaToken } from './push.native';

beforeEach(() => {
  Object.assign(nativo, {
    appOwnership: null, expoGo: false, isDevice: true, granted: true, projectId: 'proj-123', falhar: false, plataforma: 'android',
  });
  getExpoPushTokenAsync.mockClear();
  addPushTokenListener.mockClear();
});

test('development build no celular: devolve o token usando o projectId do EAS', async () => {
  expect(await obterTokenPush()).toEqual({ ok: true, token: 'ExponentPushToken[proj-123]', plataforma: 'android' });
  expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
});

test.each([
  ['Expo Go', { expoGo: true }, 'expo_go'],
  ['Expo Go (appOwnership antigo)', { appOwnership: 'expo' }, 'expo_go'],
  ['emulador', { isDevice: false }, 'emulador'],
  ['sem permissão', { granted: false }, 'sem_permissao'],
  ['sem projectId', { projectId: undefined }, 'sem_projeto'],
  ['web', { plataforma: 'web' }, 'sem_suporte'],
])('%s: não pede token', async (_nome, ajuste, motivo) => {
  Object.assign(nativo, ajuste);
  expect(await obterTokenPush()).toMatchObject({ ok: false, motivo });
  expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test('falha do serviço de push (ex.: FCM não configurado) vira motivo "erro"', async () => {
  nativo.falhar = true;
  expect(await obterTokenPush()).toEqual({
    ok: false,
    motivo: 'erro',
    detalhe: 'Default FirebaseApp is not initialized',
  });
});

test('Expo Go: não ouve a troca do token (no Android isso dá erro na tela)', () => {
  nativo.expoGo = true;
  const parar = ouvirTrocaToken(() => {});
  expect(addPushTokenListener).not.toHaveBeenCalled();
  parar();
});

test('development build: ouve a troca do token', () => {
  const parar = ouvirTrocaToken(() => {});
  expect(addPushTokenListener).toHaveBeenCalledTimes(1);
  parar();
});
