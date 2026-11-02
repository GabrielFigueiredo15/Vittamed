import React, { useState, useEffect } from 'react';

import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import estilo from './EstilosNotificacoes';
import { CHAVE_LEMBRETES_ATIVOS } from './constantes';
import { inicializarNotificacoes } from './configuracao';
import {
  reagendarTodos,
  cancelarTodosLembretes,
  listarLembretesDose,
  enviarNotificacaoTeste
} from './agendador';

// Tela de configuração dos lembretes.
// Recebe a lista de medicamentos já carregada (GET /medicamentos).
export default function TelaLembretes({ medicamentos = [] }) {

  const [ativo, setAtivo] = useState(true);
  const [permissao, setPermissao] = useState('');
  const [quantidade, setQuantidade] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {

    try {
      const valorSalvo = await AsyncStorage.getItem(CHAVE_LEMBRETES_ATIVOS);
      setAtivo(valorSalvo !== 'false'); // ligado por padrão

      setPermissao(await inicializarNotificacoes());

      const agendados = await listarLembretesDose();
      setQuantidade(agendados.length);
    } catch (error) {
      console.log(error);
    } finally {
      setCarregando(false);
    }
  };

  const salvar = async () => {

    setSalvando(true);

    try {

      await AsyncStorage.setItem(CHAVE_LEMBRETES_ATIVOS, String(ativo));

      if (ativo) {
        const total = await reagendarTodos(medicamentos);
        setQuantidade(total);
        Alert.alert('Pronto', `Lembretes ligados. ${total} próximos horários agendados.`);
      } else {
        await cancelarTodosLembretes();
        setQuantidade(0);
        Alert.alert('Pronto', 'Lembretes desligados.');
      }

    } catch (error) {

      console.log(error);

      Alert.alert('Erro', 'Não foi possível salvar os lembretes.');

    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {

    try {
      await enviarNotificacaoTeste(5);
      Alert.alert('Teste', 'Um lembrete de teste vai tocar em 5 segundos.');
    } catch (error) {
      console.log(error);
      Alert.alert('Erro', 'Não foi possível enviar o teste.');
    }
  };

  if (carregando) {
    return (
      <View style={estilo.containerCarregando}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const semPermissao = permissao === 'negada';

  return (
    <ScrollView style={estilo.container} contentContainerStyle={estilo.conteudo}>

      <Text style={estilo.titulo}>Lembretes</Text>

      <View style={estilo.caixa}>
        <Text style={estilo.paragrafo}>
          O celular vai avisar na hora de tomar cada remédio, mesmo com o aplicativo fechado.
        </Text>
        <Text style={estilo.paragrafo}>
          Próximos lembretes agendados: {quantidade}
        </Text>

        {semPermissao && (
          <Text style={estilo.aviso}>
            As notificações estão bloqueadas. Libere nas configurações do celular.
          </Text>
        )}

        {permissao === 'emulador' && (
          <Text style={estilo.aviso}>
            Use um celular de verdade para testar os lembretes.
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

      {semPermissao ? (
        <TouchableOpacity
          style={[estilo.botao, estilo.botaoSecundario]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={[estilo.textoBotao, estilo.textoBotaoSecundario]}>
            Abrir configurações
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[estilo.botao, estilo.botaoSecundario]}
          onPress={testar}
        >
          <Text style={[estilo.textoBotao, estilo.textoBotaoSecundario]}>
            Testar lembrete
          </Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}
