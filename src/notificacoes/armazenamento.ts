// Guarda configurações simples no navegador (localStorage), com cópia em memória
// caso o localStorage não exista (ex.: testes em Node).
const memoria = new Map<string, string>();

export async function lerValor(chave: string): Promise<string | null> {
  try {
    // Com localStorage disponível ele manda; a memória só vale quando não há localStorage
    if (globalThis.localStorage) return globalThis.localStorage.getItem(chave);
    return memoria.get(chave) ?? null;
  } catch {
    return memoria.get(chave) ?? null;
  }
}

export async function salvarValor(chave: string, valor: string): Promise<void> {
  memoria.set(chave, valor);
  try {
    globalThis.localStorage?.setItem(chave, valor);
  } catch {
    // sem localStorage (modo privado, cota cheia): fica só em memória
  }
}
