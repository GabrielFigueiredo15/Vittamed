import type { Dose, StatusDose } from './tipos';

export interface CriarDoseInput {
  medicamento_id: string;
  horario_previsto: string;
  status?: StatusDose;
  novo_horario?: string | null;
}

export interface AtualizarDoseInput {
  status?: StatusDose;
  horario_registrado?: string | null;
  novo_horario?: string | null;
}

export interface ConfiguracaoApiDoses {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class ErroApiDoses extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ErroApiDoses';
  }
}

export interface ClienteDoses {
  criarDose(dose: CriarDoseInput): Promise<Dose>;
  atualizarDose(id: string, atualizacao: AtualizarDoseInput): Promise<Dose>;
}

function ehDose(valor: unknown): valor is Dose {
  if (typeof valor !== 'object' || valor === null) return false;
  if (!('id' in valor) || typeof valor.id !== 'string') return false;
  if (!('medicamento_id' in valor) || typeof valor.medicamento_id !== 'string') return false;
  if (!('horario_previsto' in valor) || typeof valor.horario_previsto !== 'string') return false;
  if (!('status' in valor) ||
      !['pendente', 'tomada', 'nao_tomada', 'adiada'].includes(String(valor.status))) {
    return false;
  }
  if ('horario_registrado' in valor && valor.horario_registrado != null &&
      typeof valor.horario_registrado !== 'string') return false;
  if ('novo_horario' in valor && valor.novo_horario != null &&
      typeof valor.novo_horario !== 'string') return false;
  return true;
}

async function lerDose(response: Response): Promise<Dose> {
  const conteudo = await response.text();
  if (!conteudo) {
    throw new ErroApiDoses('A API retornou uma resposta vazia para a dose.', response.status);
  }

  let valor: unknown;
  try {
    valor = JSON.parse(conteudo);
  } catch {
    throw new ErroApiDoses('A API retornou uma resposta JSON inválida para a dose.', response.status);
  }

  if (!ehDose(valor)) {
    throw new ErroApiDoses('A API retornou dados inválidos para a dose.', response.status);
  }
  return valor;
}

async function enviar(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  metodo: 'POST' | 'PATCH',
  body: CriarDoseInput | AtualizarDoseInput
): Promise<Dose> {
  const response = await fetchImpl(url, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detalhe = await response.text();
    throw new ErroApiDoses(
      detalhe || `A API de doses respondeu com HTTP ${response.status}.`,
      response.status
    );
  }

  return lerDose(response);
}

export function criarClienteDoses(configuracao: ConfiguracaoApiDoses): ClienteDoses {
  const baseUrl = configuracao.baseUrl.trim().replace(/\/+$/, '');
  const token = configuracao.token.trim();

  if (!baseUrl) throw new Error('Informe a URL base da API de doses.');
  if (!token) throw new Error('Informe o token de autenticação da API de doses.');

  const fetchImpl = configuracao.fetchImpl ?? fetch;
  const endpoint = `${baseUrl}/doses`;

  return {
    criarDose: (dose) => enviar(fetchImpl, endpoint, token, 'POST', dose),
    atualizarDose: (id, atualizacao) => {
      if (!id.trim()) throw new Error('Informe o identificador da dose.');
      return enviar(
        fetchImpl,
        `${endpoint}/${encodeURIComponent(id)}`,
        token,
        'PATCH',
        atualizacao
      );
    },
  };
}
