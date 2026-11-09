import * as agendador from './agendador';
import * as armazenamento from './armazenamento';
import { sincronizarLembretes } from './sincronizarLembretes';
import type { Medicamento } from './tipos';

jest.mock('./agendador', () => ({
  cancelarLembretesMedicamento: jest.fn(),
  cancelarTodosLembretes: jest.fn(),
  reagendarTodos: jest.fn(),
}));

jest.mock('./armazenamento', () => ({
  lerValor: jest.fn(),
}));

const lista: Medicamento[] = [{ id: 'm2', nome: 'Remédio', ativo: true }];

beforeEach(() => {
  jest.mocked(agendador.cancelarLembretesMedicamento).mockReset().mockResolvedValue();
  jest.mocked(agendador.cancelarTodosLembretes).mockReset().mockResolvedValue();
  jest.mocked(agendador.reagendarTodos).mockReset().mockResolvedValue(1);
  jest.mocked(armazenamento.lerValor).mockReset().mockResolvedValue('true');
});

test('exclui os lembretes do medicamento removido e reagenda a lista atualizada', async () => {
  await sincronizarLembretes(lista, 'm1');

  expect(agendador.cancelarLembretesMedicamento).toHaveBeenCalledWith('m1');
  expect(agendador.reagendarTodos).toHaveBeenCalledWith(lista);
  expect(agendador.cancelarTodosLembretes).not.toHaveBeenCalled();
});

test('mantém os lembretes cancelados quando a preferência está desligada', async () => {
  jest.mocked(armazenamento.lerValor).mockResolvedValue('false');

  await sincronizarLembretes(lista, 'm1');

  expect(agendador.cancelarLembretesMedicamento).toHaveBeenCalledWith('m1');
  expect(agendador.cancelarTodosLembretes).toHaveBeenCalledTimes(1);
  expect(agendador.reagendarTodos).not.toHaveBeenCalled();
});
