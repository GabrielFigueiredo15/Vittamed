// Configuração base das notificações locais (expo-notifications).
// Instalação: npx expo install expo-notifications expo-device

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import {
  CANAL_DOSES,
  CANAL_ORIENTACOES,
  CANAL_FAMILIA,
  CATEGORIA_DOSE,
  ACAO_TOMEI,
  ACAO_ADIAR,
  ACAO_NAO_TOMEI,
  MINUTOS_ADIAR,
} from './constantes';

// Como a notificação aparece com o app aberto
export function configurarExibicao() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Canais do Android (som, vibração, prioridade). No iOS não faz nada.
export async function criarCanaisAndroid() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CANAL_DOSES, {
    name: 'Lembretes de remédio',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 300, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

// Botões direto na notificação (RF08): Tomei / Adiar / Não tomei
export async function registrarAcoesDose() {
  await Notifications.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_TOMEI, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
    {
      identifier: ACAO_ADIAR,
      buttonTitle: `Adiar ${MINUTOS_ADIAR} min`,
      options: { opensAppToForeground: false },
    },
    { identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei', options: { opensAppToForeground: true } },
  ]);
}

// Pede permissão (Android 13+ e iOS exigem).
// Retorna 'concedida', 'negada' ou 'emulador'.
export async function pedirPermissao() {
  if (!Device.isDevice) return 'emulador';

  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return 'concedida';

  const pedido = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return pedido.granted ? 'concedida' : 'negada';
}

// Tudo que precisa rodar uma vez na abertura do app
export async function inicializarNotificacoes() {
  configurarExibicao();
  await criarCanaisAndroid();
  await registrarAcoesDose();
  return pedirPermissao();
}
