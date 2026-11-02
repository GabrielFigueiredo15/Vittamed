// Textos das notificações — linguagem direta e curta (RNF05).

export function formatarHora(data) {
  const h = String(data.getHours()).padStart(2, '0');
  const m = String(data.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Ex.: "Losartana 50mg (comprimido)"
function descricaoMedicamento(med) {
  const partes = [med.nome, med.dosagem].filter(Boolean).join(' ');
  return med.forma_uso ? `${partes} (${med.forma_uso})` : partes;
}

export function textoLembreteDose(med, horario) {
  return {
    titulo: `Hora do remédio — ${formatarHora(horario)}`,
    corpo: `Tome: ${descricaoMedicamento(med)}. Toque para confirmar.`,
  };
}

export function textoDoseAdiada(med, novoHorario) {
  return {
    titulo: `Lembrete adiado — ${formatarHora(novoHorario)}`,
    corpo: `Agora é a hora de tomar: ${descricaoMedicamento(med)}.`,
  };
}

// Aviso para familiares/cuidadoras (RF09)
export function textoDoseNaoTomada(med, horarioPrevisto) {
  return {
    titulo: 'Dose não tomada',
    corpo: `${descricaoMedicamento(med)} das ${formatarHora(horarioPrevisto)} foi marcada como não tomada.`,
  };
}

// Orientação vencida — revisar até concluir ou excluir (RF14)
export function textoOrientacaoVencida(orientacao, med) {
  const resumo =
    orientacao.texto.length > 80 ? `${orientacao.texto.slice(0, 77)}...` : orientacao.texto;
  return {
    titulo: med ? `Revisar orientação — ${med.nome}` : 'Revisar orientação',
    corpo: `"${resumo}" venceu. Revise ou marque como concluída.`,
  };
}
