// Tema (claro/escuro), tamanho de texto e componentes básicos do protótipo.
// Tudo respeita o tamanho de texto escolhido em "Acessibilidade e lembretes".

import React, { createContext, useContext, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useApp, type TamanhoTexto } from './estado';

export interface Cores {
  fundo: string;
  pagina: string;
  superficie: string;
  campo: string;
  borda: string;
  texto: string;
  suave: string;
  primaria: string;
  sobrePrimaria: string;
  suaveFundo: string;
  sucesso: string;
  alerta: string;
  perigo: string;
  perigoFundo: string;
}

export const CORES_CLARO: Cores = {
  fundo: '#FFFFFF',
  pagina: '#F2F2F6',
  superficie: '#F3F1FE',
  campo: '#EEF2FB',
  borda: '#E2DEF7',
  texto: '#1A1A2E',
  suave: '#666680',
  primaria: '#5B3FD9',
  sobrePrimaria: '#FFFFFF',
  suaveFundo: '#EAE6FC',
  sucesso: '#16794D',
  alerta: '#9A5B00',
  perigo: '#C62828',
  perigoFundo: '#FDECEC',
};

export const CORES_ESCURO: Cores = {
  fundo: '#14131F',
  pagina: '#0A0A10',
  superficie: '#1F1D33',
  campo: '#28263F',
  borda: '#38355C',
  texto: '#F2F1FA',
  suave: '#A9A7C2',
  primaria: '#9A89FF',
  sobrePrimaria: '#14131F',
  suaveFundo: '#2E2A52',
  sucesso: '#5ED19B',
  alerta: '#F0B35A',
  perigo: '#FF8A8A',
  perigoFundo: '#3A2024',
};

export const ESCALA: Record<TamanhoTexto, number> = { normal: 1, grande: 1.2, muito_grande: 1.4 };

export function useTema(): { c: Cores; escala: number; escuro: boolean } {
  const { estado } = useApp();
  const escuro = estado.prefs.tema === 'escuro';
  return { c: escuro ? CORES_ESCURO : CORES_CLARO, escala: ESCALA[estado.prefs.tamanho], escuro };
}

type Variante = 'titulo' | 'subtitulo' | 'corpo' | 'pequeno' | 'rotulo';
const TAMANHOS: Record<Variante, { fontSize: number; fontWeight?: TextStyle['fontWeight'] }> = {
  titulo: { fontSize: 26, fontWeight: '700' },
  subtitulo: { fontSize: 18, fontWeight: '700' },
  corpo: { fontSize: 16 },
  pequeno: { fontSize: 14 },
  rotulo: { fontSize: 15, fontWeight: '600' },
};

interface PropsTexto {
  v?: Variante;
  cor?: keyof Cores;
  negrito?: boolean;
  centro?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  numberOfLines?: number;
}

export function T({ v = 'corpo', cor = 'texto', negrito, centro, style, children, numberOfLines }: PropsTexto) {
  const { c, escala } = useTema();
  const base = TAMANHOS[v];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: c[cor],
          fontSize: base.fontSize * escala,
          lineHeight: base.fontSize * escala * 1.4,
          fontWeight: negrito ? '700' : base.fontWeight,
        },
        centro && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Cartao({
  children,
  style,
  destaque,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  destaque?: boolean;
}) {
  const { c } = useTema();
  return (
    <View
      style={[
        {
          backgroundColor: c.superficie,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          borderWidth: destaque ? 2 : 1,
          borderColor: destaque ? c.primaria : c.borda,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type VarianteBotao = 'primario' | 'suave' | 'perigo' | 'contorno' | 'link';

export function Botao({
  titulo,
  onPress,
  v = 'primario',
  desabilitado,
  pequeno,
  style,
}: {
  titulo: string;
  onPress: () => void;
  v?: VarianteBotao;
  desabilitado?: boolean;
  pequeno?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, escala } = useTema();
  const fundo =
    v === 'primario' ? c.primaria
    : v === 'suave' ? c.suaveFundo
    : v === 'perigo' ? c.perigo
    : 'transparent';
  const cor =
    v === 'primario' ? c.sobrePrimaria
    : v === 'perigo' ? '#FFFFFF'
    : c.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: fundo,
          borderRadius: 12,
          minHeight: (pequeno ? 40 : 50) * Math.min(escala, 1.25),
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: v === 'link' ? 4 : 10,
          opacity: desabilitado ? 0.5 : pressed ? 0.8 : 1,
          borderWidth: v === 'contorno' ? 2 : 0,
          borderColor: c.primaria,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: cor,
          fontSize: (pequeno ? 14 : 16) * escala,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

interface PropsCampo {
  rotulo: string;
  valor: string;
  onChange?: (texto: string) => void;
  placeholder?: string;
  senha?: boolean;
  teclado?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  ajuda?: string;
  erro?: string;
  linhas?: number;
  somenteLeitura?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

export function Campo({
  rotulo,
  valor,
  onChange,
  placeholder,
  senha,
  teclado,
  ajuda,
  erro,
  linhas,
  somenteLeitura,
  maxLength,
  autoCapitalize,
}: PropsCampo) {
  const { c, escala } = useTema();
  const [oculta, setOculta] = useState(true);
  return (
    <View style={{ marginBottom: 14 }}>
      <T v="rotulo" style={{ marginBottom: 6 }}>{rotulo}</T>
      <View
        style={{
          backgroundColor: c.campo,
          borderRadius: 10,
          borderWidth: erro ? 2 : 1,
          borderColor: erro ? c.perigo : c.borda,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TextInput
          accessibilityLabel={rotulo}
          value={valor}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.suave}
          secureTextEntry={!!senha && oculta}
          keyboardType={teclado}
          autoCapitalize={autoCapitalize ?? (teclado === 'email-address' || senha ? 'none' : 'sentences')}
          autoCorrect={false}
          editable={!somenteLeitura}
          multiline={!!linhas}
          maxLength={maxLength}
          style={[
            {
              flex: 1,
              color: somenteLeitura ? c.suave : c.texto,
              fontSize: 16 * escala,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: linhas ? 24 * linhas * escala : undefined,
              textAlignVertical: linhas ? 'top' : 'center',
            },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null,
          ]}
        />
        {senha && (
          <Pressable
            accessibilityLabel={oculta ? 'Mostrar senha' : 'Ocultar senha'}
            onPress={() => setOculta(!oculta)}
            style={{ paddingHorizontal: 12 }}
          >
            <T v="pequeno" cor="primaria" negrito>{oculta ? 'Mostrar' : 'Ocultar'}</T>
          </Pressable>
        )}
      </View>
      {!!erro && <T v="pequeno" cor="perigo" style={{ marginTop: 4 }}>{erro}</T>}
      {!!ajuda && !erro && <T v="pequeno" cor="suave" style={{ marginTop: 4 }}>{ajuda}</T>}
    </View>
  );
}

// Opção de escolha única (círculo marcado + texto)
export function Opcao({
  texto,
  marcada,
  onPress,
  children,
}: {
  texto: string;
  marcada: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: marcada }}
      onPress={onPress}
      style={{
        backgroundColor: marcada ? c.suaveFundo : c.superficie,
        borderRadius: 12,
        borderWidth: marcada ? 2 : 1,
        borderColor: marcada ? c.primaria : c.borda,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: c.primaria,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {marcada && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primaria }} />}
        </View>
        <T negrito={marcada} style={{ flex: 1 }}>{texto}</T>
      </View>
      {marcada && children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </Pressable>
  );
}

export function Caixa({
  marcada,
  onPress,
  children,
}: {
  marcada: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: c.primaria,
          backgroundColor: marcada ? c.primaria : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        {marcada && <Text style={{ color: c.sobrePrimaria, fontWeight: '800' }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Pilula({
  texto,
  marcada,
  onPress,
}: {
  texto: string;
  marcada: boolean;
  onPress: () => void;
}) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: marcada }}
      onPress={onPress}
      style={{
        backgroundColor: marcada ? c.primaria : c.campo,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <T v="pequeno" negrito style={{ color: marcada ? c.sobrePrimaria : c.texto }}>{texto}</T>
    </Pressable>
  );
}

export function LinhaPilulas({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>;
}

// Link de voltar no topo ("← Remédios")
export function Voltar({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Voltar para ${texto}`} onPress={onPress} style={{ paddingVertical: 8, alignSelf: 'flex-start' }}>
      <T v="pequeno" cor="primaria" negrito>← {texto}</T>
    </Pressable>
  );
}

// Página rolável com margem padrão
export function Pagina({ children }: { children: React.ReactNode }) {
  const { c } = useTema();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Iniciais({ nome, tamanho = 64, foto }: { nome: string; tamanho?: number; foto?: string | null }) {
  const { c } = useTema();
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (foto) {
    return (
      <Image
        accessibilityLabel={`Foto de ${nome}`}
        source={{ uri: foto }}
        style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: c.suaveFundo }}
      />
    );
  }
  const letras = partes.length ? (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() : '?';
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: c.suaveFundo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.primaria, fontWeight: '800', fontSize: tamanho * 0.36 }}>{letras}</Text>
    </View>
  );
}

// Avisos de texto simples (Alert do RN não funciona na web)
export function avisar(titulo: string, mensagem: string): void {
  if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensagem}`);
  else Alert.alert(titulo, mensagem);
}

export function confirmar(titulo: string, mensagem: string, textoOk = 'Confirmar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: textoOk, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

// Contexto de navegação (pilha simples, sem biblioteca externa)
export type Rota =
  | { nome: 'login' }
  | { nome: 'criarConta' }
  | { nome: 'completarPerfil'; email?: string; senha?: string; editar?: boolean }
  | { nome: 'recuperarSenha' }
  | { nome: 'semConexao' }
  | { nome: 'inicio' }
  | { nome: 'remedios' }
  | { nome: 'perfil' }
  | { nome: 'calendario'; dia?: string }
  | { nome: 'historico'; dia?: string }
  | { nome: 'assistente' }
  | { nome: 'avisos' }
  | { nome: 'acessibilidade' }
  | { nome: 'dadosRemedio'; id?: string }
  | { nome: 'programar'; medId?: string; rascunho: RascunhoRemedio }
  | { nome: 'detalhes'; id: string }
  | { nome: 'horaRemedio'; medId: string; horario: string }
  | { nome: 'orientacoes'; medId: string }
  | { nome: 'dadosOrientacao'; medId: string; id?: string; ver?: boolean };

export interface RascunhoRemedio {
  nome: string;
  dosagem: string;
  forma_uso: string;
  observacoes: string;
  foto_url?: string | null;
}

export interface Navegacao {
  rota: Rota;
  ir: (rota: Rota) => void;
  voltar: () => void;
  raiz: (rota: Rota) => void;
}

export const ContextoNavegacao = createContext<Navegacao | null>(null);

export function useNav(): Navegacao {
  const nav = useContext(ContextoNavegacao);
  if (!nav) throw new Error('useNav fora da navegação');
  return nav;
}

// Foto da embalagem (ou espaço reservado quando ainda não há imagem)
export function FotoEmbalagem({ uri }: { uri?: string | null }) {
  const { c } = useTema();
  return (
    <View style={{ backgroundColor: c.superficie, borderRadius: 14, borderWidth: 1, borderColor: c.borda, marginBottom: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', minHeight: 110 }}>
      {uri ? (
        <Image accessibilityLabel="Foto da embalagem" source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 170 }} />
      ) : (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <T v="pequeno" cor="suave">Foto da embalagem</T>
          <T v="pequeno" cor="suave">Placeholder • sem imagem</T>
        </View>
      )}
    </View>
  );
}

// Confirmação de exclusão dentro da própria tela
export function ConfirmarExclusao({
  titulo,
  texto,
  rotuloConfirmar,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  texto: string;
  rotuloConfirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { c } = useTema();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.perigoFundo, borderRadius: 14, borderWidth: 1, borderColor: c.perigo, padding: 14, marginBottom: 12 }}>
      <T v="rotulo" style={{ marginBottom: 4 }}>{titulo}</T>
      <T v="pequeno" style={{ marginBottom: 10 }}>{texto}</T>
      <Botao titulo={rotuloConfirmar} v="perigo" onPress={onConfirmar} />
      <Botao titulo="Cancelar" v="link" onPress={onCancelar} />
    </View>
  );
}
