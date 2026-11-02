// Constantes do módulo de notificações, espelhando o CONTRATO.md (seções 4, 5 e 6).

// Agendamento.tipo
export const TIPO_FIXO = 'fixo';
export const TIPO_INTERVALO = 'intervalo';
export const TIPO_DIAS_SEMANA = 'dias_semana';

// Dose.status
export const STATUS_PENDENTE = 'pendente';
export const STATUS_TOMADA = 'tomada';
export const STATUS_NAO_TOMADA = 'nao_tomada';
export const STATUS_ADIADA = 'adiada';

// Canais do Android (cada um com som/prioridade próprios)
export const CANAL_DOSES = 'doses';
export const CANAL_ORIENTACOES = 'orientacoes';
export const CANAL_FAMILIA = 'familia';

// Botões na notificação de dose (RF08)
export const CATEGORIA_DOSE = 'dose';
export const ACAO_TOMEI = 'tomei';
export const ACAO_ADIAR = 'adiar';
export const ACAO_NAO_TOMEI = 'nao_tomei';

export const MINUTOS_ADIAR = 15;

// Chave do AsyncStorage para a preferência do usuário
export const CHAVE_LEMBRETES_ATIVOS = '@lembretes_ativos';
