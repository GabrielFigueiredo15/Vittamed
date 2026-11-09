import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { parseHorario } from './agendamento';
import type { Medicamento, TipoAgendamento } from './tipos';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface Props {
  medicamentos?: Medicamento[];
  carregando?: boolean;
  erroInicializacao?: string;
  onSalvar?: (medicamentos: Medicamento[], removidoId?: string) => Promise<void>;
  onAbrirLembretes?: () => void;
}

interface Formulario {
  id?: string;
  nome: string;
  dosagem: string;
  tipo: TipoAgendamento;
  horarios: string;
  intervaloHoras: string;
  diasSemana: number[];
  ativo: boolean;
}

const formularioVazio = (): Formulario => ({
  nome: '',
  dosagem: '',
  tipo: 'fixo',
  horarios: '08:00',
  intervaloHoras: '8',
  diasSemana: [0, 1, 2, 3, 4, 5, 6],
  ativo: true,
});

function formularioDe(medicamento: Medicamento): Formulario {
  const agendamento = medicamento.agendamento;
  return {
    id: medicamento.id,
    nome: medicamento.nome,
    dosagem: medicamento.dosagem || '',
    tipo: agendamento?.tipo || 'fixo',
    horarios: (agendamento?.horarios || ['08:00']).join(', '),
    intervaloHoras: String(agendamento?.intervalo_horas || 8),
    diasSemana: agendamento?.dias_semana || [0, 1, 2, 3, 4, 5, 6],
    ativo: medicamento.ativo !== false,
  };
}

function descreverAgendamento(medicamento: Medicamento): string {
  const agendamento = medicamento.agendamento;
  if (!agendamento) return 'Sem lembretes configurados';

  const horarios = (agendamento.horarios || []).join(', ') || '08:00';
  if (agendamento.tipo === 'intervalo') {
    return `A cada ${agendamento.intervalo_horas || 8}h, a partir de ${horarios}`;
  }
  if (agendamento.tipo === 'dias_semana') {
    const dias = (agendamento.dias_semana || [])
      .map((dia) => DIAS[dia])
      .filter(Boolean)
      .join(', ');
    return `${dias || 'Nenhum dia'} · ${horarios}`;
  }
  return `Todos os dias · ${horarios}`;
}

function confirmarExclusao(mensagem: string, aoConfirmar: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(mensagem)) aoConfirmar();
    return;
  }
  Alert.alert('Excluir medicamento', mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: aoConfirmar },
  ]);
}

export default function TelaMedicamentos({
  medicamentos = [],
  carregando = false,
  erroInicializacao,
  onSalvar,
  onAbrirLembretes,
}: Props) {
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<boolean>(false);

  const avisar = (titulo: string, mensagem: string): void => {
    if (Platform.OS === 'web') {
      window.alert(`${titulo}\n\n${mensagem}`);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const abrirEdicao = (medicamento: Medicamento): void => {
    setErro(null);
    setFormulario(formularioDe(medicamento));
  };

  const salvar = async (): Promise<void> => {
    if (!formulario || !onSalvar) return;

    const nome = formulario.nome.trim();
    const horarios = formulario.horarios
      .split(',')
      .map((horario) => horario.trim())
      .filter(Boolean);

    if (!nome) {
      setErro('Informe o nome do medicamento.');
      return;
    }
    if (horarios.length === 0 || horarios.some((horario) => !parseHorario(horario))) {
      setErro('Informe horários válidos no formato HH:MM, separados por vírgula.');
      return;
    }
    if (formulario.tipo === 'intervalo') {
      const intervalo = Number(formulario.intervaloHoras);
      if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 24) {
        setErro('O intervalo deve ser um número inteiro entre 1 e 24 horas.');
        return;
      }
    }
    if (formulario.tipo === 'dias_semana' && formulario.diasSemana.length === 0) {
      setErro('Selecione pelo menos um dia da semana.');
      return;
    }

    const agendamento = formulario.tipo === 'intervalo'
      ? {
          tipo: 'intervalo' as const,
          horarios: [horarios[0]],
          intervalo_horas: Number(formulario.intervaloHoras),
        }
      : formulario.tipo === 'dias_semana'
      ? {
          tipo: 'dias_semana' as const,
          horarios,
          dias_semana: formulario.diasSemana,
        }
      : { tipo: 'fixo' as const, horarios };

    const existente = medicamentos.find((item) => item.id === formulario.id);
    const atualizado: Medicamento = {
      ...(existente || {}),
      id: formulario.id || `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nome,
      dosagem: formulario.dosagem.trim() || null,
      ativo: formulario.ativo,
      agendamento,
      criado_em: existente?.criado_em || new Date().toISOString(),
    };
    const novaLista = existente
      ? medicamentos.map((item) => item.id === atualizado.id ? atualizado : item)
      : [...medicamentos, atualizado];

    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(novaLista);
      setFormulario(null);
      avisar('Salvo', 'Medicamento e lembretes atualizados.');
    } catch (error) {
      console.error('Não foi possível salvar o medicamento ou atualizar seus lembretes.', error);
      setErro('O medicamento não pôde ser salvo ou os lembretes não puderam ser atualizados.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = (medicamento: Medicamento): void => {
    confirmarExclusao(`Deseja excluir ${medicamento.nome}?`, () => {
      const novaLista = medicamentos.filter((item) => item.id !== medicamento.id);
      setSalvando(true);
      void (async () => {
        try {
          if (!onSalvar) throw new Error('A ação de salvar medicamentos não está disponível.');
          await onSalvar(novaLista, medicamento.id);
        } catch (error) {
          console.error('Não foi possível excluir o medicamento ou cancelar seus lembretes.', error);
          setErro('O medicamento não pôde ser excluído ou os lembretes não puderam ser atualizados.');
        } finally {
          setSalvando(false);
        }
      })();
    });
  };

  const atualizarFormulario = (mudancas: Partial<Formulario>): void => {
    setFormulario((atual) => atual ? { ...atual, ...mudancas } : atual);
    setErro(null);
  };

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Text style={estilos.titulo}>Medicamentos</Text>
      <Text style={estilos.introducao}>
        Cadastre e organize os horários dos seus medicamentos.
      </Text>

      {erroInicializacao ? (
        <Text accessibilityRole="alert" style={estilos.erro}>{erroInicializacao}</Text>
      ) : (
        <>
          {onAbrirLembretes && (
            <TouchableOpacity style={[estilos.botao, estilos.botaoClaro]} onPress={onAbrirLembretes}>
              <Text style={[estilos.textoBotao, estilos.textoBotaoEscuro]}>Configurar lembretes</Text>
            </TouchableOpacity>
          )}

          {formulario ? (
            <View style={estilos.cartao}>
              <Text style={estilos.subtitulo}>
                {formulario.id ? 'Editar medicamento' : 'Novo medicamento'}
              </Text>

              <Text style={estilos.rotulo}>Nome</Text>
              <TextInput
                accessibilityLabel="Nome do medicamento"
                style={estilos.campo}
                value={formulario.nome}
                onChangeText={(nome) => atualizarFormulario({ nome })}
                placeholder="Ex.: Losartana"
              />
              <Text style={estilos.rotulo}>Dosagem (opcional)</Text>
              <TextInput
                accessibilityLabel="Dosagem"
                style={estilos.campo}
                value={formulario.dosagem}
                onChangeText={(dosagem) => atualizarFormulario({ dosagem })}
                placeholder="Ex.: 50 mg"
              />

              <Text style={estilos.rotulo}>Tipo de horário</Text>
              <View style={estilos.opcoes}>
                {([
                  ['fixo', 'Diário'],
                  ['intervalo', 'Intervalo'],
                  ['dias_semana', 'Dias da semana'],
                ] as const).map(([tipo, titulo]) => (
                  <TouchableOpacity
                    key={tipo}
                    style={[estilos.opcao, formulario.tipo === tipo && estilos.opcaoSelecionada]}
                    onPress={() => atualizarFormulario({ tipo })}
                  >
                    <Text style={[estilos.textoOpcao, formulario.tipo === tipo && estilos.textoOpcaoSelecionada]}>
                      {titulo}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={estilos.rotulo}>
                {formulario.tipo === 'intervalo' ? 'Horário inicial' : 'Horários (HH:MM)'}
              </Text>
              <TextInput
                accessibilityLabel="Horários"
                style={estilos.campo}
                value={formulario.horarios}
                onChangeText={(horarios) => atualizarFormulario({ horarios })}
                placeholder="08:00, 20:00"
              />
              {formulario.tipo === 'intervalo' && (
                <>
                  <Text style={estilos.rotulo}>Repetir a cada (horas)</Text>
                  <TextInput
                    accessibilityLabel="Intervalo em horas"
                    style={estilos.campo}
                    value={formulario.intervaloHoras}
                    onChangeText={(intervaloHoras) => atualizarFormulario({ intervaloHoras })}
                    keyboardType="number-pad"
                  />
                </>
              )}
              {formulario.tipo === 'dias_semana' && (
                <View style={estilos.opcoes}>
                  {DIAS.map((dia, indice) => {
                    const selecionado = formulario.diasSemana.includes(indice);
                    return (
                      <TouchableOpacity
                        key={dia}
                        style={[estilos.dia, selecionado && estilos.opcaoSelecionada]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selecionado }}
                        onPress={() => atualizarFormulario({
                          diasSemana: selecionado
                            ? formulario.diasSemana.filter((item) => item !== indice)
                            : [...formulario.diasSemana, indice].sort(),
                        })}
                      >
                        <Text style={[estilos.textoOpcao, selecionado && estilos.textoOpcaoSelecionada]}>
                          {dia}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={estilos.linhaAtivo}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: formulario.ativo }}
                onPress={() => atualizarFormulario({ ativo: !formulario.ativo })}
              >
                <View style={[estilos.checkbox, formulario.ativo && estilos.checkboxMarcado]}>
                  {formulario.ativo && <Text style={estilos.simboloCheckbox}>✓</Text>}
                </View>
                <Text style={estilos.texto}>Medicamento ativo</Text>
              </TouchableOpacity>

              {erro && <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text>}

              <TouchableOpacity
                style={[estilos.botao, salvando && estilos.desabilitado]}
                onPress={() => void salvar()}
                disabled={salvando}
              >
                <Text style={estilos.textoBotao}>{salvando ? 'Salvando...' : 'Salvar medicamento'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[estilos.botao, estilos.botaoClaro]}
                onPress={() => {
                  setFormulario(null);
                  setErro(null);
                }}
                disabled={salvando}
              >
                <Text style={[estilos.textoBotao, estilos.textoBotaoEscuro]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={estilos.botao} onPress={() => {
                setErro(null);
                setFormulario(formularioVazio());
              }}>
                <Text style={estilos.textoBotao}>Adicionar medicamento</Text>
              </TouchableOpacity>

              {medicamentos.length === 0 ? (
                <View style={estilos.cartao}>
                  <Text style={estilos.texto}>Nenhum medicamento cadastrado.</Text>
                </View>
              ) : medicamentos.map((medicamento) => (
                <View key={medicamento.id} style={estilos.cartao}>
                  <Text style={estilos.subtitulo}>{medicamento.nome}</Text>
                  {!!medicamento.dosagem && <Text style={estilos.texto}>{medicamento.dosagem}</Text>}
                  <Text style={estilos.texto}>{descreverAgendamento(medicamento)}</Text>
                  {medicamento.ativo === false && <Text style={estilos.inativo}>Inativo</Text>}
                  <View style={estilos.acoes}>
                    <TouchableOpacity style={[estilos.botaoAcao, estilos.botaoEditar]} onPress={() => abrirEdicao(medicamento)}>
                      <Text style={estilos.textoBotao}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[estilos.botaoAcao, estilos.botaoExcluir]} onPress={() => excluir(medicamento)}>
                      <Text style={estilos.textoBotao}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {erro && <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text>}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f5f5f5' },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  conteudo: { padding: 24, paddingTop: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#000000', marginBottom: 8 },
  introducao: { fontSize: 18, lineHeight: 26, color: '#333333', marginBottom: 20 },
  subtitulo: { fontSize: 23, fontWeight: 'bold', color: '#000000', marginBottom: 8 },
  rotulo: { fontSize: 18, fontWeight: '600', color: '#111111', marginBottom: 6 },
  texto: { fontSize: 18, color: '#222222', lineHeight: 26, marginBottom: 6 },
  campo: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#777777',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 18,
    marginBottom: 16,
  },
  cartao: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dddddd',
  },
  botao: {
    minHeight: 56,
    backgroundColor: '#000000',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  botaoClaro: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000' },
  textoBotao: { color: '#ffffff', fontSize: 19, fontWeight: 'bold', textAlign: 'center' },
  textoBotaoEscuro: { color: '#000000' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  opcao: {
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  opcaoSelecionada: { backgroundColor: '#000000', borderColor: '#000000' },
  textoOpcao: { fontSize: 16, color: '#000000', fontWeight: '600' },
  textoOpcaoSelecionada: { color: '#ffffff' },
  dia: { minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: '#555555', borderRadius: 8, padding: 11, marginRight: 6, marginBottom: 6 },
  linhaAtivo: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  checkbox: { width: 30, height: 30, borderWidth: 2, borderColor: '#000000', borderRadius: 5, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxMarcado: { backgroundColor: '#000000' },
  simboloCheckbox: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  acoes: { flexDirection: 'row', marginTop: 12 },
  botaoAcao: { flex: 1, minHeight: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  botaoEditar: { backgroundColor: '#000000' },
  botaoExcluir: { backgroundColor: '#8b0000' },
  desabilitado: { opacity: 0.5 },
  erro: { color: '#b00020', fontSize: 17, fontWeight: 'bold', marginBottom: 14 },
  inativo: { color: '#8b0000', fontSize: 16, fontWeight: 'bold', marginTop: 4 },
});
