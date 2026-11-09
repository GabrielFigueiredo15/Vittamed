// Escolher foto na web (perfil e embalagem do remédio).
// No Android o Metro usa foto.native.ts (expo-image-picker) no lugar deste arquivo.
// A imagem é reduzida e guardada como data URI, que sobrevive a recarregar a página.

export type ResultadoFoto = { uri: string } | 'negada' | null;

const LADO_MAXIMO = 640;

function lerArquivo(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

function reduzir(dataUri: string): Promise<string> {
  return new Promise((resolve) => {
    const imagem = new Image();
    imagem.onload = () => {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imagem.width * escala));
      canvas.height = Math.max(1, Math.round(imagem.height * escala));
      const contexto = canvas.getContext('2d');
      if (!contexto) return resolve(dataUri);
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    imagem.onerror = () => resolve(dataUri);
    imagem.src = dataUri;
  });
}

// null = a pessoa cancelou
export function escolherFoto(_quadrada: boolean = true): Promise<ResultadoFoto> {
  return new Promise((resolve, reject) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/*';
    entrada.onchange = async () => {
      const arquivo = entrada.files?.[0];
      if (!arquivo) return resolve(null);
      try {
        resolve({ uri: await reduzir(await lerArquivo(arquivo)) });
      } catch (erro) {
        reject(erro);
      }
    };
    entrada.oncancel = () => resolve(null);
    entrada.click();
  });
}
