// Escolher foto da galeria no Android (expo-image-picker).
// Guardamos a imagem como data URI pequena: sobrevive a reiniciar o app.
import * as ImagePicker from 'expo-image-picker';

export type ResultadoFoto = { uri: string } | 'negada' | null;

// null = a pessoa cancelou; 'negada' = sem permissão para abrir a galeria
export async function escolherFoto(quadrada: boolean = true): Promise<ResultadoFoto> {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return 'negada';

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: quadrada ? [1, 1] : [4, 3],
    quality: 0.3,
    base64: true,
  });
  const imagem = resultado.canceled ? null : resultado.assets[0];
  if (!imagem?.base64) return null;
  return { uri: `data:image/jpeg;base64,${imagem.base64}` };
}
