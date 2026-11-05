import React, { useState, useEffect } from 'react';

import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';

import estilo from './EstilosNotificacoes';
import { CHAVE_LEMBRETES_ATIVOS } from './constantes';
import type { Medicamento, ResultadoPermissao } from './tipos';
import {
  inicializarNotificacoes,
  pedirPermissao,
  permissaoBloqueada,
  notificacoesNativas
} from './configuracao';
import { lerValor, salvarValor } from './armazenamento';
import {
  reagendarTodos,
  cancelarTodosLembretes,
  listarLembretesDose,
  enviarNotificacaoTeste
} from './agendador';

interface Props {
  medicamentos?: Medicamento[]; // lista já carregada (GET /medicamentos)
}

const NATIVO = Platform.OS !== 'web';

// Alert do react-native não faz nada na web; lá usamos o alert do navegador
const avisar = (titulo: string, mensagem: string): void => {
  if (NATIVO) {
    Alert.alert(titulo, mensagem);
    return;
  }
  window.alert(`${titulo}\n\n${mensagem}`);
};

// Tela de configuração dos lembretes
export default function TelaLembretes({ medicamentos = [] }: Props) {

  const [ativo, setAtivo] = useState<boolean>(true);
  const [permissao, setPermissao] = useState<ResultadoPermissao | null>(null);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [bloqueada, setBloqueada] = useState<boolean>(false);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async (): Promise<void> => {

    try {
      setAtivo((await lerValor(CHAVE_LEMBRETES_ATIVOS)) !== 'false'); // ligado por padrão
      setPermissao(await inicializarNotificacoes());
      setBloqueada(await permissaoBloqueada());

      const agendados = await listarLembretesDose();
      setQuantidade(agendados.length);
    } catch (error) {
      console.log(error);
    } finally {
      setCarregando(false);
    }
  };

  const salvar = async (): Promise<void> => {

    setSalvando(true);

    try {

      await salvarValor(CHAVE_LEMBRETES_ATIVOS, String(ativo));

      if (ativo) {
        setPermissao(await pedirPermissao());
        setBloqueada(await permissaoBloqueada());
        const total = await reagendarTodos(medicamentos);
        setQuantidade(total);
        avisar('Pronto', `Lembretes ligados. ${total} próximos horários agendados.${notificacoesNativas() ? '' : ' Mantenha o app aberto.'}`);
      } else {
        await cancelarTodosLembretes();
        setQuantidade(0);
        avisar('Pronto', 'Lembretes desligados.');
      }

    } catch (error) {

      console.log(error);

      avisar('Erro', 'Não foi possível salvar os lembretes.');

    } finally {
      setSalvando(false);
    }
  };

  const testar = async (): Promise<void> => {

    try {
      setPermissao(await pedirPermissao());
      setBloqueada(await permissaoBloqueada());
      await enviarNotificacaoTeste(5);
      avisar('Teste', 'Um lembrete de teste vai aparecer em 5 segundos.');
    } catch (error) {
      console.log(error);
      avisar('Erro', 'Não foi possível enviar o teste.');
    }
  };

  if (carregando) {
    return (
      <View style={estilo.containerCarregando}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const semPermissao = permissao === 'negada' && bloqueada;

  return (
    <ScrollView style={estilo.container} contentContainerStyle={estilo.conteudo}>

      <Text style={estilo.titulo}>Lembretes</Text>

      <View style={estilo.caixa}>
        <Text style={estilo.paragrafo}>
          {notificacoesNativas()
            ? 'O aparelho vai avisar na hora de tomar cada remédio, mesmo com o app fechado.'
            : NATIVO
            ? 'Modo Expo Go: os avisos aparecem só com o app aberto. Para avisos com o app fechado, use npm run android.'
            : 'O navegador vai avisar na hora de tomar cada remédio, enquanto esta página estiver aberta.'}
        </Text>
        <Text style={estilo.paragrafo}>
          Próximos lembretes agendados: {quantidade}
        </Text>

        {semPermissao && (
          <Text style={estilo.aviso}>
            As notificações estão bloqueadas.{' '}
            {NATIVO
              ? 'Libere nas configurações do aparelho.'
              : 'Libere nas configurações do site no navegador.'}
          </Text>
        )}
      </View>

      <TouchableOpacity style={estilo.linhaCheckbox} onPress={() => setAtivo(!ativo)}>
        <View style={[estilo.checkbox, ativo && estilo.checkboxMarcado]}>
          {ativo && <Text style={estilo.checkboxSimbolo}>✓</Text>}
        </View>
        <Text style={estilo.textoCheckbox}>Receber lembretes dos remédios</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[estilo.botao, salvando && estilo.botaoDesabilitado]}
        onPress={salvar}
        disabled={salvando}
      >
        <Text style={estilo.textoBotao}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[estilo.botao, estilo.botaoSecundario]}
        onPress={testar}
      >
        <Text style={[estilo.textoBotao, estilo.textoBotaoSecundario]}>
          Testar lembrete
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}
