// Permissão e canal de notificações no Android (expo-notifications).
// Sem o módulo nativo (Expo Go) as funções seguem funcionando em modo reduzido.
import { Platform } from 'react-native';
import {
  CANAL_DOSES,
  CANAL_DOSES_VISUAL,
  CANAL_DOSES_SOM,
  CANAL_DOSES_VIBRACAO,
  CATEGORIA_DOSE,
  ACAO_TOMEI,
  ACAO_ADIAR,
  ACAO_NAO_TOMEI,
} from './constantes';
import { obterNotificacoes } from './expoNotifications.native';
import type { ResultadoPermissao } from './tipos';

export function notificacoesSuportadas(): boolean {
  return true;
}

// true = avisos do sistema (funcionam com o app fechado); false = só com o app aberto
export function notificacoesNativas(): boolean {
  return obterNotificacoes() !== null;
}

// Mostra o aviso mesmo com o app aberto
obterNotificacoes()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// No Android 8+ toda notificação precisa de um canal; no 13+ o canal
// deve existir antes de pedir a permissão.
async function criarCanais(): Promise<void> {
  const N = obterNotificacoes();
  if (!N || Platform.OS !== 'android') return;
  const publico = N.AndroidNotificationVisibility.PUBLIC;
  await N.setNotificationChannelAsync(CANAL_DOSES, {
    name: 'Lembretes de doses',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: publico,
  });
  // Um canal por formato escolhido em "Acessibilidade e lembretes"
  await N.setNotificationChannelAsync(CANAL_DOSES_VISUAL, {
    name: 'Lembretes só visuais',
    importance: N.AndroidImportance.HIGH,
    sound: null,
    enableVibrate: false,
    lockscreenVisibility: publico,
  });
  await N.setNotificationChannelAsync(CANAL_DOSES_SOM, {
    name: 'Lembretes com som',
    importance: N.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: false,
    lockscreenVisibility: publico,
  });
  await N.setNotificationChannelAsync(CANAL_DOSES_VIBRACAO, {
    name: 'Lembretes com vibração',
    importance: N.AndroidImportance.HIGH,
    sound: null,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: publico,
  });
}

// Botões que aparecem na notificação de dose (RF08)
async function registrarBotoes(): Promise<void> {
  const N = obterNotificacoes();
  if (!N) return;
  // Abrem o app para o registro da dose ser gravado e sincronizado
  const opcoes = { opensAppToForeground: true };
  await N.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_TOMEI, buttonTitle: 'Tomei', options: opcoes },
    { identifier: ACAO_ADIAR, buttonTitle: 'Adiar', options: opcoes },
    { identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei', options: opcoes },
  ]);
}

export async function pedirPermissao(): Promise<ResultadoPermissao> {
  const N = obterNotificacoes();
  if (!N) return 'concedida'; // Expo Go: avisos via Alert, sem permissão do sistema
  await criarCanais();
  await registrarBotoes();
  let atual = await N.getPermissionsAsync();
  if (!atual.granted && atual.canAskAgain) {
    atual = await N.requestPermissionsAsync();
  }
  return atual.granted ? 'concedida' : 'negada';
}

// Roda na abertura da tela; só consulta, sem abrir o pedido de permissão
export async function inicializarNotificacoes(): Promise<ResultadoPermissao> {
  const N = obterNotificacoes();
  if (!N) return 'concedida';
  await criarCanais();
  await registrarBotoes();
  const atual = await N.getPermissionsAsync();
  return atual.granted ? 'concedida' : 'negada';
}

// Bloqueada de vez: o usuário precisa liberar nas configurações do sistema
export async function permissaoBloqueada(): Promise<boolean> {
  const N = obterNotificacoes();
  if (!N) return false;
  const atual = await N.getPermissionsAsync();
  return !atual.granted && !atual.canAskAgain;
}
