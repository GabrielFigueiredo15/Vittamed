// Token de push do aparelho (RF09 — aviso à família).
//
// O backend usa este token para avisar os outros aparelhos da conta quando
// uma dose é marcada como "não tomada". Funciona só em development build ou
// no app publicado: o Expo Go não recebe push remoto no Android.
//
// Requisitos:
//  - app.json -> expo.extra.eas.projectId (criado com `eas init`);
//  - Android: credenciais do FCM no EAS (google-services.json + chave do FCM V1).

import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { obterNotificacoes } from './expoNotifications.native';

export type MotivoSemToken =
  | 'sem_suporte'     // web ou módulo nativo ausente
  | 'expo_go'         // Expo Go não recebe push remoto
  | 'emulador'        // emulador/simulador não recebe push
  | 'sem_permissao'   // pessoa não liberou as notificações
  | 'sem_projeto'     // falta extra.eas.projectId no app.json
  | 'erro';           // falha ao falar com o serviço de push (ex.: FCM não configurado)

export type ResultadoToken =
  | { ok: true; token: string; plataforma: 'android' | 'ios' }
  | { ok: false; motivo: MotivoSemToken; detalhe?: string };

// Expo Go: o push remoto foi removido no Android (SDK 53+) e chamar
// addPushTokenListener ou getExpoPushTokenAsync lá dá erro na tela.
// Usa a mesma checagem do expo-notifications (isRunningInExpoGo); o
// executionEnvironment "storeClient" também vale para a development build.
export function estaNoExpoGo(): boolean {
  return isRunningInExpoGo() || Constants.appOwnership === 'expo';
}

function idDoProjeto(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export async function obterTokenPush(): Promise<ResultadoToken> {
  const N = obterNotificacoes();
  if (!N || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return { ok: false, motivo: 'sem_suporte' };
  if (estaNoExpoGo()) return { ok: false, motivo: 'expo_go' };
  if (!Device.isDevice) return { ok: false, motivo: 'emulador' };

  // Não pede permissão aqui: ela é pedida quando a pessoa cadastra um remédio
  const permissao = await N.getPermissionsAsync();
  if (!permissao.granted) return { ok: false, motivo: 'sem_permissao' };

  const projectId = idDoProjeto();
  if (!projectId) return { ok: false, motivo: 'sem_projeto' };

  try {
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data, plataforma: Platform.OS };
  } catch (erro) {
    return { ok: false, motivo: 'erro', detalhe: erro instanceof Error ? erro.message : String(erro) };
  }
}

// O token pode mudar (reinstalação, restauração de backup): avisa para registrar de novo
export function ouvirTrocaToken(aoTrocar: () => void): () => void {
  const N = obterNotificacoes();
  if (!N || estaNoExpoGo()) return () => {};
  const assinatura = N.addPushTokenListener(() => aoTrocar());
  return () => assinatura.remove();
}
