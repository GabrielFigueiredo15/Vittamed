// Carrega o expo-notifications de forma protegida.
// No Expo Go o módulo nativo não existe e o import derrubaria o app inteiro;
// nesse caso devolvemos null e o app usa o agendador em memória.
import type * as ExpoNotifications from 'expo-notifications';

let modulo: typeof ExpoNotifications | null | undefined;

export function obterNotificacoes(): typeof ExpoNotifications | null {
  if (modulo === undefined) {
    try {
      modulo = require('expo-notifications') as typeof ExpoNotifications;
    } catch {
      modulo = null;
    }
  }
  return modulo;
}
