// Meu perfil e Acessibilidade e lembretes.

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { enviarNotificacaoTeste } from '../../notificacoes/agendador';
import {
  inicializarNotificacoes,
  notificacoesNativas,
  pedirPermissao,
  permissaoBloqueada,
} from '../../notificacoes/configuracao';
import type { ResultadoPermissao } from '../../notificacoes/tipos';
import { calcularIdade } from '../datas';
import { useApp, type TamanhoTexto } from '../estado';
import { Botao, Cartao, Iniciais, Opcao, Pagina, Pilula, LinhaPilulas, T, Voltar, avisar, confirmar, useNav, useTema } from '../ui';

export function TelaPerfil() {
  const { estado, atualizarPrefs, sair } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const u = estado.usuario;
  const idade = calcularIdade(u?.nascimento);

  const Item = ({ icone, titulo, sub, onPress, direita }: { icone: string; titulo: string; sub?: string; onPress?: () => void; direita?: React.ReactNode }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.superficie, borderRadius: 12, borderWidth: 1, borderColor: c.borda, padding: 12, marginBottom: 8 }}
    >
      <T style={{ marginRight: 12 }}>{icone}</T>
      <View style={{ flex: 1 }}>
        <T negrito>{titulo}</T>
        {!!sub && <T v="pequeno" cor="suave">{sub}</T>}
      </View>
      {direita ?? <T cor="suave">›</T>}
    </Pressable>
  );

  const aoSair = async () => {
    if (await confirmar('Sair da conta?', 'Os lembretes deste aparelho serão pausados até você entrar de novo.', 'Sair')) sair();
  };

  return (
    <Pagina>
      <T v="titulo" style={{ marginBottom: 16 }}>Meu perfil</T>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Iniciais nome={u?.nome ?? ''} tamanho={72} foto={u?.foto} />
        <T v="subtitulo" style={{ marginTop: 8 }}>{u?.nome}</T>
        {idade !== null && <T v="pequeno" cor="suave">{idade} anos</T>}
        <T v="pequeno" cor="suave" centro style={{ marginTop: 8 }}>
          Esta conta é para você e sua família/cuidador. Mesmo e-mail e senha.
        </T>
      </View>

      <Item icone="👤" titulo="Minha conta" sub="Dados pessoais e segurança" onPress={() => nav.ir({ nome: 'completarPerfil', editar: true })} />
      <Item
        icone="🔔"
        titulo="Lembretes"
        sub="Acessibilidade: som, vibração e lembretes"
        onPress={() => nav.ir({ nome: 'acessibilidade' })}
        direita={
          <Switch
            accessibilityLabel="Ligar ou desligar lembretes"
            value={estado.prefs.lembretes}
            onValueChange={(v) => {
              atualizarPrefs({ lembretes: v });
              if (v) void pedirPermissao();
            }}
            trackColor={{ true: c.primaria, false: c.borda }}
          />
        }
      />
      <Item icone="🔤" titulo="Tamanho do texto" sub="Ajustes de acessibilidade" onPress={() => nav.ir({ nome: 'acessibilidade' })} />
      <Item
        icone="❓"
        titulo="Central de ajuda"
        sub="Dúvidas sobre o app"
        onPress={() => avisar('Central de ajuda', 'Cadastre seus remédios na aba Remédios. Os lembretes tocam na hora marcada; toque na notificação para dizer se tomou, adiou ou não tomou.')}
      />

      <View style={{ backgroundColor: c.superficie, borderRadius: 12, borderWidth: 1, borderColor: c.borda, padding: 12, marginBottom: 8 }}>
        <T negrito>🎨 Tema</T>
        <LinhaPilulas>
          <Pilula texto="Claro" marcada={estado.prefs.tema === 'claro'} onPress={() => atualizarPrefs({ tema: 'claro' })} />
          <Pilula texto="Escuro" marcada={estado.prefs.tema === 'escuro'} onPress={() => atualizarPrefs({ tema: 'escuro' })} />
        </LinhaPilulas>
      </View>

      <Botao titulo="Sair da conta" v="contorno" onPress={aoSair} style={{ marginTop: 8 }} />
    </Pagina>
  );
}

const TAMANHOS: { id: TamanhoTexto; nome: string }[] = [
  { id: 'normal', nome: 'Normal' },
  { id: 'grande', nome: 'Grande' },
  { id: 'muito_grande', nome: 'Muito grande' },
];

export function TelaAcessibilidade() {
  const { estado, atualizarPrefs, sincronizar } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const [tamanho, setTamanho] = useState(estado.prefs.tamanho);
  const [formato, setFormato] = useState(estado.prefs.formato);
  const [permissao, setPermissao] = useState<ResultadoPermissao | null>(null);
  const [bloqueada, setBloqueada] = useState(false);

  useEffect(() => {
    (async () => {
      setPermissao(await inicializarNotificacoes());
      setBloqueada(await permissaoBloqueada());
    })();
  }, []);

  const salvar = () => {
    atualizarPrefs({ tamanho, formato });
    avisar('Pronto', 'Preferências salvas.');
    nav.voltar();
  };

  const testar = async () => {
    const resultado = await pedirPermissao();
    setPermissao(resultado);
    setBloqueada(await permissaoBloqueada());
    if (resultado === 'negada') return avisar('Notificações bloqueadas', 'Libere as notificações nas configurações para receber os lembretes.');
    await sincronizar();
    await enviarNotificacaoTeste(5);
    avisar('Teste', 'Um lembrete de teste vai aparecer em 5 segundos.');
  };

  const exemplo =
    formato === 'visual' ? 'Aviso visual na tela com nome e horário. Sem som e sem vibração.'
    : formato === 'som' ? 'Aviso visual na tela com nome e horário, mais um toque de lembrete.'
    : 'Aviso visual na tela com nome e horário, mais vibração do aparelho.';

  return (
    <Pagina>
      <Voltar texto="Perfil" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 16 }}>Acessibilidade e lembretes</T>

      <T v="rotulo" style={{ marginBottom: 8 }}>Tamanho do texto</T>
      {TAMANHOS.map((t) => (
        <Opcao key={t.id} texto={`${t.nome}${tamanho === t.id ? ' • selecionado' : ''}`} marcada={tamanho === t.id} onPress={() => setTamanho(t.id)} />
      ))}

      <Cartao>
        <T v="pequeno" cor="suave">Prévia • {TAMANHOS.find((t) => t.id === tamanho)?.nome}</T>
        <T style={{ fontSize: 16 * (tamanho === 'normal' ? 1 : tamanho === 'grande' ? 1.2 : 1.4) }}>
          Hora do remédio. Metformina às 12:00.
        </T>
      </Cartao>

      <T v="rotulo" style={{ marginVertical: 8 }}>Formatos do lembrete</T>
      <Opcao texto="Aviso visual ativado" marcada={formato === 'visual'} onPress={() => setFormato('visual')} />
      <Opcao texto="Som ativado • tocar para mudar" marcada={formato === 'som'} onPress={() => setFormato('som')} />
      <Opcao texto="Vibração ativada • mudar" marcada={formato === 'vibracao'} onPress={() => setFormato('vibracao')} />

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 4 }}>Exemplo de lembrete</T>
        <T negrito>12:00 • Metformina 500 mg</T>
        <T v="pequeno" style={{ marginTop: 4 }}>{exemplo}</T>
      </Cartao>

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 4 }}>Notificações neste aparelho</T>
        <T v="pequeno" cor={permissao === 'concedida' ? 'sucesso' : 'alerta'} negrito>
          {permissao === 'concedida' ? 'Permitidas' : bloqueada ? 'Bloqueadas nas configurações' : 'Ainda não permitidas'}
        </T>
        <T v="pequeno" cor="suave" style={{ marginTop: 4 }}>
          {notificacoesNativas()
            ? 'Os avisos tocam mesmo com o app fechado.'
            : Platform.OS === 'web'
            ? 'No navegador, os avisos só aparecem com esta página aberta.'
            : 'Modo Expo Go: os avisos aparecem só com o app aberto. Use npm run android para avisos com o app fechado.'}
        </T>
        <Botao titulo="Testar lembrete" v="suave" onPress={testar} style={{ marginTop: 10, marginBottom: 0 }} />
      </Cartao>

      <Botao titulo="Salvar preferências" onPress={salvar} />
    </Pagina>
  );
}
