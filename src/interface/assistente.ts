// Assistente de IA (RF15, RF16, RNF07).
//
// Parte das perguntas é respondida no próprio aparelho, sem internet:
//  - dúvida clínica (dose, interação, efeito adverso, interromper ou mudar o
//    tratamento): recusa e encaminha a médico ou farmacêutico (RF16);
//  - perguntas sobre os dados cadastrados: próxima dose, doses de hoje,
//    horários e lista de remédios.
// O resto vai para a IA do servidor (POST /chat), com a lista de remédios
// cadastrados como contexto. O servidor também tem a trava clínica.

import type { Medicamento } from '../notificacoes/tipos';
import { dosesDoDia, medicamentoFinalizado, proximaDose, resumoDias, resumoHorarios, type Registro } from './doses';
import { formatarHora } from '../notificacoes/textos';
import { dataLonga } from './datas';

export const AVISO_ASSISTENTE =
  'Não substitui orientação médica, farmacêutica ou de enfermagem.';

export const SEM_CLINICA =
  'Para dúvidas sobre dose, interações, efeitos adversos ou mudança no tratamento, fale com seu médico ou farmacêutico.';

const normalizar = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const descricao = (m: Medicamento): string => [m.nome, m.dosagem].filter(Boolean).join(' ');

const CLINICA = new RegExp(
  [
    'posso tomar', 'quanto(s)? (comprimido|gota|mg|ml)', 'dose maxima', 'dobr',
    'interac', 'misturar', 'junto com', 'efeito', 'reacao', 'colateral',
    'aumentar', 'diminuir', 'parar de tomar', 'interromp', 'suspend',
    'alterar (a )?dose', 'alterar o tratamento', 'mudar (a )?dose', 'trocar o remedio',
  ].join('|')
);

export function ehPerguntaClinica(pergunta: string): boolean {
  return CLINICA.test(normalizar(pergunta));
}

// Resposta feita no aparelho; null quando a pergunta deve ir para a IA
export function respostaLocal(
  pergunta: string,
  meds: Medicamento[],
  registros: Registro[],
  agora: Date = new Date()
): string | null {
  const p = normalizar(pergunta);

  if (CLINICA.test(p)) return SEM_CLINICA;

  if (/proxim[ao]s? (dose|remedio|medicamento)|quando (e|sera) a proxima/.test(p)) {
    const prox = proximaDose(meds, registros, agora);
    return prox
      ? `Sua próxima dose é ${descricao(prox.med)}, ${dataLonga(prox.horario)} às ${formatarHora(prox.horario)}.`
      : 'Não encontrei próximas doses. Cadastre um remédio na aba Remédios.';
  }

  if (/(doses?|remedios?|medicamentos?|agenda) (de|para) hoje|hoje eu tomo|tomo hoje/.test(p)) {
    const doses = dosesDoDia(meds, registros, agora);
    if (doses.length === 0) return 'Você não tem doses programadas para hoje.';
    const linhas = doses.map((d) => `${formatarHora(d.horario)} — ${descricao(d.med)}`);
    return `Doses de hoje:\n${linhas.join('\n')}`;
  }

  if (/meus horarios|que horas tomo|horarios dos? (meus )?(remedios|medicamentos)/.test(p) && meds.length > 0) {
    return meds.map((m) => `${descricao(m)}: ${resumoHorarios(m)}`).join('\n');
  }

  if (/quais (remedios|medicamentos)|meus (remedios|medicamentos)|(remedios|medicamentos) cadastrad|lista de (remedios|medicamentos)/.test(p)) {
    if (meds.length === 0) return 'Você ainda não tem remédios cadastrados.';
    return `Você tem ${meds.length} ${meds.length === 1 ? 'remédio cadastrado' : 'remédios cadastrados'}:\n${meds
      .map(descricao)
      .join('\n')}`;
  }

  return null;
}

// Usada quando não dá para falar com a IA (sem internet ou servidor fora do ar)
export function responderAssistente(
  pergunta: string,
  meds: Medicamento[],
  registros: Registro[],
  agora: Date = new Date()
): string {
  return (
    respostaLocal(pergunta, meds, registros, agora) ??
    `Posso ajudar com seus remédios cadastrados e horários. Tente perguntar "Quais remédios tenho cadastrados?" ou "Qual é a próxima dose?". ${SEM_CLINICA}`
  );
}

// Nome do remédio cadastrado citado na pergunta (usado na busca da bula pelo servidor)
export function remedioCitado(pergunta: string, meds: Medicamento[]): string | undefined {
  const p = normalizar(pergunta);
  const citado = meds
    .filter((m) => m.nome.trim().length >= 3)
    .sort((a, b) => b.nome.length - a.nome.length)
    .find((m) => p.includes(normalizar(m.nome.trim())));
  return citado?.nome.trim();
}

// Texto com os remédios cadastrados, enviado junto da pergunta para a IA
export function contextoRemedios(meds: Medicamento[], agora: Date = new Date()): string {
  if (meds.length === 0) return 'A pessoa ainda não cadastrou remédios no Vittamed.';
  const linhas = meds.map((m) => {
    const partes = [
      descricao(m),
      m.forma_uso,
      `horários: ${resumoHorarios(m)}`,
      `dias: ${resumoDias(m)}`,
      m.observacoes ? `observações: ${m.observacoes}` : null,
      medicamentoFinalizado(m, agora) ? 'tratamento encerrado' : null,
    ];
    return `- ${partes.filter(Boolean).join('; ')}`;
  });
  return `Remédios cadastrados no Vittamed:\n${linhas.join('\n')}`;
}
