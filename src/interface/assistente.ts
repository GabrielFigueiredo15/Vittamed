// Assistente de IA do protótipo: respostas simples sobre os dados cadastrados no app.
// Não dá orientação clínica; só consulta o que a pessoa já registrou.

import type { Medicamento } from '../notificacoes/tipos';
import { dosesDoDia, proximaDose, resumoHorarios, type Registro } from './doses';
import { formatarHora } from '../notificacoes/textos';
import { dataLonga } from './datas';

export const AVISO_ASSISTENTE =
  'Não substitui orientação médica, farmacêutica ou de enfermagem.';

const SEM_CLINICA =
  'Para dúvidas sobre dose, interações, efeitos adversos ou mudança no tratamento, fale com seu médico ou farmacêutico.';

const normalizar = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const descricao = (m: Medicamento): string => [m.nome, m.dosagem].filter(Boolean).join(' ');

export function responderAssistente(
  pergunta: string,
  meds: Medicamento[],
  registros: Registro[],
  agora: Date = new Date()
): string {
  const p = normalizar(pergunta);

  // Pergunta clínica: não responde, só encaminha
  if (/(posso tomar|interac|efeito|reacao|dose maxima|aumentar|diminuir|parar de tomar|misturar|junto com)/.test(p)) {
    return SEM_CLINICA;
  }

  if (/(proxim|proxima|quando)/.test(p)) {
    const prox = proximaDose(meds, registros, agora);
    return prox
      ? `Sua próxima dose é ${descricao(prox.med)}, ${dataLonga(prox.horario)} às ${formatarHora(prox.horario)}.`
      : 'Não encontrei próximas doses. Cadastre um remédio na aba Remédios.';
  }

  if (/(hoje|agenda|dia)/.test(p)) {
    const doses = dosesDoDia(meds, registros, agora);
    if (doses.length === 0) return 'Você não tem doses programadas para hoje.';
    const linhas = doses.map((d) => `${formatarHora(d.horario)} — ${descricao(d.med)}`);
    return `Doses de hoje:\n${linhas.join('\n')}`;
  }

  if (/(horario|que horas)/.test(p) && meds.length > 0) {
    return meds.map((m) => `${descricao(m)}: ${resumoHorarios(m)}`).join('\n');
  }

  if (/(quais|remedio|medicamento|tomo|cadastrad|lista)/.test(p)) {
    if (meds.length === 0) return 'Você ainda não tem remédios cadastrados.';
    return `Você tem ${meds.length} ${meds.length === 1 ? 'remédio cadastrado' : 'remédios cadastrados'}:\n${meds
      .map(descricao)
      .join('\n')}`;
  }

  return `Posso ajudar com seus remédios cadastrados e horários. Tente perguntar "Quais remédios tenho cadastrados?" ou "Qual é a próxima dose?". ${SEM_CLINICA}`;
}
