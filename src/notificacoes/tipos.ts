// Tipos espelhando o CONTRATO.md do backend (seções 4, 5 e 6).

export type TipoAgendamento = 'fixo' | 'intervalo' | 'dias_semana';

export interface Agendamento {
  tipo: TipoAgendamento;
  horarios?: string[] | null;        // "HH:MM" — tipo=fixo (usado também em dias_semana)
  intervalo_horas?: number | null;   // tipo=intervalo
  dias_semana?: number[] | null;     // tipo=dias_semana | 0=seg .. 6=dom
}

export interface Medicamento {
  id: string;
  nome: string;
  dosagem?: string | null;
  forma_uso?: string | null;
  agendamento?: Agendamento | null;
  periodo_inicio?: string | null;    // "YYYY-MM-DD"
  periodo_fim?: string | null;       // "YYYY-MM-DD"
  observacoes?: string | null;
  foto_url?: string | null;
  ativo?: boolean;
  criado_em?: string | null;         // ISO 8601 UTC
}

export type StatusDose = 'pendente' | 'tomada' | 'nao_tomada' | 'adiada';

export interface Dose {
  id: string;
  medicamento_id: string;
  horario_previsto: string;          // ISO 8601 UTC
  status: StatusDose;
  horario_registrado?: string | null;
  novo_horario?: string | null;
}

export interface Orientacao {
  id: string;
  medicamento_id: string;
  texto: string;
  validade?: string | null;          // "YYYY-MM-DD"
  concluida?: boolean;
}

// Dados anexados a cada notificação, usados ao tocar nela
export type DadosNotificacao =
  | { tipo: 'dose'; medicamentoId: string; horarioPrevisto: string; doseId?: string }
  | { tipo: 'orientacao'; orientacaoId: string; medicamentoId: string };

export interface ConteudoNotificacao {
  titulo: string;
  corpo: string;
}

export type ResultadoPermissao = 'concedida' | 'negada' | 'emulador';
