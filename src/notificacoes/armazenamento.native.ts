// Guarda configurações simples no aparelho (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function lerValor(chave: string): Promise<string | null> {
  return AsyncStorage.getItem(chave);
}

export async function salvarValor(chave: string, valor: string): Promise<void> {
  await AsyncStorage.setItem(chave, valor);
}
