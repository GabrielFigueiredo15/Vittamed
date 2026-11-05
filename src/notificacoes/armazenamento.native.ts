// Guarda configurações simples no aparelho (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function lerValor(chave: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(chave);
  } catch {
    return null;
  }
}

export async function salvarValor(chave: string, valor: string): Promise<void> {
  try {
    await AsyncStorage.setItem(chave, valor);
  } catch {
    // sem espaço/permissão: a preferência não é guardada
  }
}
