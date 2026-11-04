import TelaLembretes from './notificacoes/TelaLembretes';
import type { Medicamento } from './notificacoes/tipos';

// Medicamentos de exemplo; troque pela resposta real da API (GET /medicamentos)
const medicamentos: Medicamento[] = [
  { id: 'm1', nome: 'Losartana', dosagem: '50mg', ativo: true,
    agendamento: { tipo: 'fixo', horarios: ['08:00', '20:00'] } },
  { id: 'm2', nome: 'Metformina', dosagem: '850mg', ativo: true,
    agendamento: { tipo: 'intervalo', intervalo_horas: 8, horarios: ['06:00'] } },
];

export default function App() {
  return <TelaLembretes medicamentos={medicamentos} />;
}
