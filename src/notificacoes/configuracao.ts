// Configuração base das notificações locais no React Native.
// Usa expo-notifications (funciona em projetos Expo e em React Native "bare"
// com `npx install-expo-modules`). Instalação:
//   npx expo install expo-notifications expo-device

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export const CANAL_DOSES = 'doses';
export const CANAL_ORIENTACOES = 'orientacoes';
export const CANAL_FAMILIA = 'familia';

export const CATEGORIA_DOSE = 'dose';
export const ACAO_TOMEI = 'tomei';
export const ACAO_ADIAR = 'adiar';
export const ACAO_NAO_TOMEI = 'nao_tomei';

/** Como a notificação aparece com o app aberto. Chamar uma vez no App.tsx. */
export function configurarExibicao(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canais do Android (som, vibração, prioridade). No iOS não faz nada. */
export async function criarCanaisAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CANAL_DOSES, {
    name: 'Lembretes de remédio',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 300, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync(CANAL_ORIENTACOES, {
    name: 'Orientações de uso',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync(CANAL_FAMILIA, {
    name: 'Avisos para a família',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** Botões direto na notificação (RF08): Tomei / Adiar / Não tomei. */
export async function registrarAcoesDose(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_TOMEI, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
    { identifier: ACAO_ADIAR, buttonTitle: 'Adiar 15 min', options: { opensAppToForeground: false } },
    { identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei', options: { opensAppToForeground: true } },
  ]);
}

export type ResultadoPermissao = 'concedida' | 'negada' | 'emulador';

/** Pede permissão de notificação (Android 13+ e iOS exigem). */
export async function pedirPermissao(): Promise<ResultadoPermissao> {
  if (!Device.isDevice) return 'emulador';

  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return 'concedida';

  const pedido = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return pedido.granted ? 'concedida' : 'negada';
}

/** Tudo que precisa rodar na inicialização do app. */
export async function inicializarNotificacoes(): Promise<ResultadoPermissao> {
  configurarExibicao();
  await criarCanaisAndroid();
  await registrarAcoesDose();
  return pedirPermissao();
}
