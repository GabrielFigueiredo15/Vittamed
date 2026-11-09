import {
  cancelarLembretesMedicamento,
  cancelarTodosLembretes,
  reagendarTodos,
} from './agendador';
import { CHAVE_LEMBRETES_ATIVOS } from './constantes';
import { lerValor } from './armazenamento';
import type { Medicamento } from './tipos';

export async function sincronizarLembretes(
  medicamentos: Medicamento[],
  medicamentoRemovidoId?: string
): Promise<void> {
  if (medicamentoRemovidoId) {
    await cancelarLembretesMedicamento(medicamentoRemovidoId);
  }

  if ((await lerValor(CHAVE_LEMBRETES_ATIVOS)) === 'false') {
    await cancelarTodosLembretes();
    return;
  }

  await reagendarTodos(medicamentos);
}
