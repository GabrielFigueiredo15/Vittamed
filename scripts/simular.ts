// Simula os lembretes sem celular: mostra os próximos horários e os textos
// que seriam notificados. Rodar com: npm run simular

import { proximosHorarios } from '../src/notificacoes/agendamento';
import { textoLembreteDose } from '../src/notificacoes/textos';
import type { Medicamento } from '../src/notificacoes/tipos';

const agora = new Date();
const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

const medicamentos: Medicamento[] = [
  {
    id: 'm1', nome: 'Losartana', dosagem: '50mg', forma_uso: 'comprimido', ativo: true,
    agendamento: { tipo: 'fixo', horarios: ['08:00', '20:00'] },
  },
  {
    id: 'm2', nome: 'Metformina', dosagem: '850mg', forma_uso: 'comprimido', ativo: true,
    periodo_inicio: hoje,
    agendamento: { tipo: 'intervalo', intervalo_horas: 8, horarios: ['06:00'] },
  },
  {
    id: 'm3', nome: 'Vitamina D', dosagem: '2000UI', forma_uso: 'gotas', ativo: true,
    agendamento: { tipo: 'dias_semana', horarios: ['09:00'], dias_semana: [0, 2, 4] },
  },
  {
    id: 'm4', nome: 'Antibiótico', ativo: true, periodo_fim: '2020-01-01',
    agendamento: { tipo: 'fixo', horarios: ['08:00'] },
  },
];

console.log(`Agora: ${agora.toLocaleString('pt-BR')}\n`);

for (const med of medicamentos) {
  const horarios = proximosHorarios(med, agora);
  console.log(`${med.nome}: ${horarios.length === 0 ? 'nenhum lembrete (encerrado ou inativo)' : ''}`);
  for (const h of horarios) {
    const t = textoLembreteDose(med, h);
    console.log(`  ${h.toLocaleString('pt-BR')}  ->  "${t.titulo}" | ${t.corpo}`);
  }
  console.log('');
}
