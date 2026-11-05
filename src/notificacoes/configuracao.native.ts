// Permissão e canal de notificações no Android (expo-notifications).
// Sem o módulo nativo (Expo Go) as funções seguem funcionando em modo reduzido.
import { Platform } from 'react-native';
import { CANAL_DOSES } from './constantes';
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
  await N.setNotificationChannelAsync(CANAL_DOSES, {
    name: 'Lembretes de doses',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function pedirPermissao(): Promise<ResultadoPermissao> {
  const N = obterNotificacoes();
  if (!N) return 'concedida'; // Expo Go: avisos via Alert, sem permissão do sistema
  await criarCanais();
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
