// Testes de push.native.ts (token de push no Android/iOS) com os módulos nativos simulados.

const nativo = {
  appOwnership: null as string | null,
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
jest.mock('expo-device', () => ({ get isDevice() { return nativo.isDevice; } }));
const getExpoPushTokenAsync = jest.fn(async ({ projectId }: { projectId: string }) => {
  if (nativo.falhar) throw new Error('Default FirebaseApp is not initialized');
  return { type: 'expo', data: `ExponentPushToken[${projectId}]` };
});
jest.mock('./expoNotifications.native', () => ({
  obterNotificacoes: () => ({
    getPermissionsAsync: async () => ({ granted: nativo.granted }),
    getExpoPushTokenAsync,
    addPushTokenListener: () => ({ remove: () => {} }),
  }),
}));

import { obterTokenPush } from './push.native';

beforeEach(() => {
  Object.assign(nativo, {
    appOwnership: null, isDevice: true, granted: true, projectId: 'proj-123', falhar: false, plataforma: 'android',
  });
  getExpoPushTokenAsync.mockClear();
});

test('development build no celular: devolve o token usando o projectId do EAS', async () => {
  expect(await obterTokenPush()).toEqual({ ok: true, token: 'ExponentPushToken[proj-123]', plataforma: 'android' });
  expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
});

test.each([
  ['Expo Go', { appOwnership: 'expo' }, 'expo_go'],
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
