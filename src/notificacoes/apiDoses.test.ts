import {
  criarClienteDoses,
  ErroApiDoses,
  type ConfiguracaoApiDoses,
} from './apiDoses';
import type { Dose } from './tipos';

const dose: Dose = {
  id: 'dose-1',
  medicamento_id: 'med-1',
  horario_previsto: '2026-11-09T15:00:00.000Z',
  status: 'pendente',
};

function resposta(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function configurarFetch(
  fetchImpl: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>
): ConfiguracaoApiDoses {
  return {
    baseUrl: 'https://api.example.test/v1/',
    token: 'token-de-teste',
    fetchImpl,
  };
}

test('cria dose com POST, Bearer token e corpo JSON', async () => {
  const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(resposta(JSON.stringify(dose)));
  const cliente = criarClienteDoses(configurarFetch(fetchImpl));

  await expect(cliente.criarDose({
    medicamento_id: 'med-1',
    horario_previsto: dose.horario_previsto,
  })).resolves.toEqual(dose);

  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/doses',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-de-teste',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        medicamento_id: 'med-1',
        horario_previsto: dose.horario_previsto,
      }),
    })
  );
});

test('atualiza dose usando PATCH e codifica o id do recurso', async () => {
  const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(resposta(JSON.stringify({
    ...dose,
    status: 'adiada',
    novo_horario: '2026-11-09T15:15:00.000Z',
  })));
  const cliente = criarClienteDoses(configurarFetch(fetchImpl));
  const atualizacao = {
    status: 'adiada' as const,
    novo_horario: '2026-11-09T15:15:00.000Z',
  };

  await cliente.atualizarDose('dose/1', atualizacao);

  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/doses/dose%2F1',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify(atualizacao),
    })
  );
});

test('informa erro HTTP sem transformar falha em sucesso', async () => {
  const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(resposta('Sem autorização', 401));
  const cliente = criarClienteDoses(configurarFetch(fetchImpl));

  await expect(cliente.criarDose({
    medicamento_id: 'med-1',
    horario_previsto: dose.horario_previsto,
  })).rejects.toMatchObject<Partial<ErroApiDoses>>({
    name: 'ErroApiDoses',
    status: 401,
    message: 'Sem autorização',
  });
});

test('rejeita configuração sem URL ou token', () => {
  expect(() => criarClienteDoses({ baseUrl: ' ', token: 'abc' })).toThrow(
    'Informe a URL base da API de doses.'
  );
  expect(() => criarClienteDoses({ baseUrl: 'https://api.example.test', token: ' ' })).toThrow(
    'Informe o token de autenticação da API de doses.'
  );
});

test('rejeita resposta de sucesso sem JSON de dose', async () => {
  const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(resposta(''));
  const cliente = criarClienteDoses(configurarFetch(fetchImpl));

  await expect(cliente.criarDose({
    medicamento_id: 'med-1',
    horario_previsto: dose.horario_previsto,
  })).rejects.toMatchObject({
    name: 'ErroApiDoses',
    status: 200,
  });
});
