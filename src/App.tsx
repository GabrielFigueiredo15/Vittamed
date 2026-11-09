import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Alert, Platform } from 'react-native';
import TelaMedicamentos from './notificacoes/TelaMedicamentos';
import TelaLembretes from './notificacoes/TelaLembretes';
import { lerValor, salvarValor } from './notificacoes/armazenamento';
import {
  ACAO_ADIAR,
  ACAO_NAO_TOMEI,
  ACAO_TOMEI,
  CHAVE_MEDICAMENTOS,
} from './notificacoes/constantes';
import {
  ouvirRespostasNotificacao,
  registrarAcoesNotificacao,
} from './notificacoes/respostasNotificacao';
import { sincronizarLembretes } from './notificacoes/sincronizarLembretes';
import type { Medicamento } from './notificacoes/tipos';

// Medicamentos de exemplo; troque pela resposta real da API (GET /medicamentos)
const medicamentos: Medicamento[] = [
  { id: 'm1', nome: 'Losartana', dosagem: '50mg', ativo: true,
    agendamento: { tipo: 'fixo', horarios: ['08:00', '20:00'] } },
  { id: 'm2', nome: 'Metformina', dosagem: '850mg', ativo: true,
    agendamento: { tipo: 'intervalo', intervalo_horas: 8, horarios: ['06:00'] } },
];

function ehListaDeMedicamentos(valor: unknown): valor is Medicamento[] {
  if (!Array.isArray(valor)) return false;

  return valor.every((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('nome' in item)) {
      return false;
    }

    if (typeof item.id !== 'string' || typeof item.nome !== 'string') return false;
    if ('ativo' in item && item.ativo !== undefined && typeof item.ativo !== 'boolean') return false;
    if ('dosagem' in item && item.dosagem !== undefined && item.dosagem !== null && typeof item.dosagem !== 'string') return false;
    if ('agendamento' in item && item.agendamento != null) {
      const agendamento: unknown = item.agendamento;
      if (typeof agendamento !== 'object' || agendamento === null || !('tipo' in agendamento)) return false;
      if (!['fixo', 'intervalo', 'dias_semana'].includes(String(agendamento.tipo))) return false;
      if (
        'horarios' in agendamento &&
        agendamento.horarios != null &&
        (!Array.isArray(agendamento.horarios) || !agendamento.horarios.every((horario) => typeof horario === 'string'))
      ) return false;
      if (
        'intervalo_horas' in agendamento &&
        agendamento.intervalo_horas != null &&
        typeof agendamento.intervalo_horas !== 'number'
      ) return false;
      if (
        'dias_semana' in agendamento &&
        agendamento.dias_semana != null &&
        (!Array.isArray(agendamento.dias_semana) ||
          !agendamento.dias_semana.every((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6))
      ) return false;
    }
    return true;
  });
}

export default function App() {
  const [listaMedicamentos, setListaMedicamentos] = useState<Medicamento[]>(medicamentos);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erroInicializacao, setErroInicializacao] = useState<string | null>(null);
  const [telaLembretes, setTelaLembretes] = useState<boolean>(false);
  const medicamentosRef = useRef<Medicamento[]>(medicamentos);

  useEffect(() => {
    let inicializado = false;
    let desmontado = false;

    const removerListener = ouvirRespostasNotificacao((resposta) => {
      const acao = resposta.actionIdentifier === ACAO_TOMEI
        ? 'Você selecionou “Tomei”.'
        : resposta.actionIdentifier === ACAO_ADIAR
        ? 'Você selecionou “Adiar”.'
        : resposta.actionIdentifier === ACAO_NAO_TOMEI
        ? 'Você selecionou “Não tomei”.'
        : 'Você abriu o lembrete.';
      const mensagem = `${acao}\n\n${resposta.corpo}`;
      if (Platform.OS === 'web') {
        window.alert(`${resposta.titulo}\n\n${mensagem}`);
      } else {
        Alert.alert(resposta.titulo || 'Lembrete', mensagem);
      }
    });

    const subscription = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && inicializado) {
        void sincronizarLembretes(medicamentosRef.current).catch((error: unknown) => {
          console.error('Não foi possível sincronizar os lembretes.', error);
        });
      }
    });

    const carregar = async (): Promise<void> => {
      try {
        await registrarAcoesNotificacao();
        const salvo = await lerValor(CHAVE_MEDICAMENTOS);
        let lista = medicamentos;

        if (salvo !== null) {
          const valor: unknown = JSON.parse(salvo);
          if (!ehListaDeMedicamentos(valor)) {
            throw new Error('A lista salva de medicamentos está inválida.');
          }
          lista = valor;
        } else {
          await salvarValor(CHAVE_MEDICAMENTOS, JSON.stringify(lista));
        }

        medicamentosRef.current = lista;
        if (!desmontado) setListaMedicamentos(lista);
        await sincronizarLembretes(lista);
        inicializado = true;
      } catch (error) {
        console.error('Não foi possível carregar os medicamentos.', error);
        if (!desmontado) {
          setErroInicializacao('Não foi possível carregar os medicamentos salvos.');
        }
      } finally {
        if (!desmontado) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      desmontado = true;
      subscription.remove();
      removerListener();
    };
  }, []);

  const salvarMedicamentos = async (
    novaLista: Medicamento[],
    removidoId?: string
  ): Promise<void> => {
    await salvarValor(CHAVE_MEDICAMENTOS, JSON.stringify(novaLista));
    medicamentosRef.current = novaLista;
    setListaMedicamentos(novaLista);
    await sincronizarLembretes(novaLista, removidoId);
  };

  if (erroInicializacao) {
    return <TelaMedicamentos erroInicializacao={erroInicializacao} />;
  }

  if (carregando) {
    return <TelaMedicamentos carregando />;
  }

  if (telaLembretes) {
    return (
      <TelaLembretes
        medicamentos={listaMedicamentos}
        onVoltar={() => setTelaLembretes(false)}
      />
    );
  }

  return (
    <TelaMedicamentos
      medicamentos={listaMedicamentos}
      onSalvar={salvarMedicamentos}
      onAbrirLembretes={() => setTelaLembretes(true)}
    />
  );
}
