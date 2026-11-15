// Permissão e canal de notificações no Android (expo-notifications).
// Sem o módulo nativo (Expo Go) as funções seguem funcionando em modo reduzido.
import { Platform } from 'react-native';
import {
  CANAL_DOSES,
  CANAL_DOSES_VISUAL,
  CANAL_DOSES_SOM,
  CANAL_DOSES_VIBRACAO,
  CANAL_FAMILIA,
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

type Notificacoes = NonNullable<ReturnType<typeof obterNotificacoes>>;
type OpcoesCanal = Parameters<Notificacoes['setNotificationChannelAsync']>[1];

// Cria um canal sem deixar a falha de um derrubar os outros. Se a opção
// principal for recusada, tenta a alternativa: o Expo Go no Android dá
// NullPointerException com "sound: null" (o jeito oficial de tirar o som),
// então o canal sem som cai para importância baixa, que também não toca som.
async function criarCanal(N: Notificacoes, id: string, opcoes: OpcoesCanal, alternativa?: OpcoesCanal): Promise<void> {
  try {
    await N.setNotificationChannelAsync(id, opcoes);
    return;
  } catch (erro) {
    if (!alternativa) {
      console.log(`Canal "${id}" não foi criado:`, erro);
      return;
    }
  }
  try {
    await N.setNotificationChannelAsync(id, alternativa);
  } catch (erro) {
    console.log(`Canal "${id}" não foi criado:`, erro);
  }
}

// No Android 8+ toda notificação precisa de um canal; no 13+ o canal
// deve existir antes de pedir a permissão.
async function criarCanais(): Promise<void> {
  const N = obterNotificacoes();
  if (!N || Platform.OS !== 'android') return;
  const publico = N.AndroidNotificationVisibility.PUBLIC;
  await criarCanal(N, CANAL_DOSES, {
    name: 'Lembretes de doses',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: publico,
  });
  // Um canal por formato escolhido em "Acessibilidade e lembretes"
  await criarCanal(
    N,
    CANAL_DOSES_VISUAL,
    { name: 'Lembretes só visuais', importance: N.AndroidImportance.HIGH, sound: null, enableVibrate: false, lockscreenVisibility: publico },
    { name: 'Lembretes só visuais', importance: N.AndroidImportance.LOW, enableVibrate: false, lockscreenVisibility: publico }
  );
  await criarCanal(N, CANAL_DOSES_SOM, {
    name: 'Lembretes com som',
    importance: N.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: false,
    lockscreenVisibility: publico,
  });
  await criarCanal(
    N,
    CANAL_DOSES_VIBRACAO,
    { name: 'Lembretes com vibração', importance: N.AndroidImportance.HIGH, sound: null, vibrationPattern: [0, 400, 200, 400], lockscreenVisibility: publico },
    { name: 'Lembretes com vibração', importance: N.AndroidImportance.LOW, enableVibrate: true, vibrationPattern: [0, 400, 200, 400], lockscreenVisibility: publico }
  );
  // Push do backend para a família quando uma dose não é tomada (RF09)
  await criarCanal(N, CANAL_FAMILIA, {
    name: 'Avisos para a família',
    importance: N.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: publico,
  });
}

// Botões que aparecem na notificação de dose (RF08)
async function registrarBotoes(): Promise<void> {
  const N = obterNotificacoes();
  if (!N) return;
  // Abrem o app para o registro da dose ser gravado e sincronizado
  const opcoes = { opensAppToForeground: true };
  try {
    await N.setNotificationCategoryAsync(CATEGORIA_DOSE, [
      { identifier: ACAO_TOMEI, buttonTitle: 'Tomei', options: opcoes },
      { identifier: ACAO_ADIAR, buttonTitle: 'Adiar', options: opcoes },
      { identifier: ACAO_NAO_TOMEI, buttonTitle: 'Não tomei', options: opcoes },
    ]);
  } catch (erro) {
    // Sem os botões, tocar na notificação ainda abre a tela da dose
    console.log('Botões da notificação não foram registrados:', erro);
  }
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
