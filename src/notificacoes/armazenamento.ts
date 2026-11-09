// Guarda configurações simples no navegador (localStorage), com cópia em memória
// caso o localStorage não exista (ex.: testes em Node).
const memoria = new Map<string, string>();

export async function lerValor(chave: string): Promise<string | null> {
  const armazenamento = globalThis.localStorage;
  return armazenamento
    ? armazenamento.getItem(chave) ?? memoria.get(chave) ?? null
    : memoria.get(chave) ?? null;
}

export async function salvarValor(chave: string, valor: string): Promise<void> {
  const armazenamento = globalThis.localStorage;
  if (armazenamento) armazenamento.setItem(chave, valor);
  memoria.set(chave, valor);
}
