// Estado do app (conta, remédios, doses, orientações, preferências).
// Fica salvo no aparelho (AsyncStorage no Android, localStorage na web) e,
// a cada mudança, os lembretes do sistema são recalculados (microtarefas 10 e 11).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  agendarLembreteAdiado,
  cancelarLembreteDose,
  cancelarLembretesAdiados,
  cancelarLembretesMedicamento,
  cancelarLembretesOrientacao,
  cancelarTodosLembretes,
  definirFormatoLembrete,
  reagendarOrientacoes,
  reagendarTodos,
  type FormatoLembrete,
} from '../notificacoes/agendador';
import { pedirPermissao } from '../notificacoes/configuracao';
import { lerValor, salvarValor } from '../notificacoes/armazenamento';
import * as api from '../api/auth';
import { aoExpirarSessao, ehErroApi } from '../api/cliente';
import { carregarSessao, limparSessao, sessaoAtual } from '../api/sessao';
import { alterarSync, carregarSync, enfileirar, estadoSync, prepararSync } from '../api/filaSync';
import { baixarDados, enviarFila, mesclar, reconciliar } from '../api/sincronizacao';
import { desregistrarAparelho, registrarAparelho } from '../api/aparelho';
import { ouvirTrocaToken } from '../notificacoes/push';
import type { Medicamento, Orientacao, StatusDose } from '../notificacoes/tipos';
import { chaveDose, type Registro } from './doses';

export type TamanhoTexto = 'normal' | 'grande' | 'muito_grande';
export type TemaApp = 'claro' | 'escuro';

// A senha não fica no aparelho: o login é feito na API (CONTRATO.md, seção 1)
export interface Usuario {
  email: string;
  nome: string;
  celular: string;
  nascimento: string;               // "YYYY-MM-DD"
  genero: string;
  foto?: string | null;             // data URI
}

export interface Preferencias {
  tamanho: TamanhoTexto;
  formato: FormatoLembrete;
  lembretes: boolean;
  tema: TemaApp;
}

export interface OrientacaoApp extends Orientacao {
  inicio?: string | null;           // "YYYY-MM-DD"
}

export interface Estado {
  uid: string | null;               // dono dos dados locais (uid da API)
  usuario: Usuario | null;
  sessao: boolean;
  lembrar: boolean;
  medicamentos: Medicamento[];
  registros: Registro[];
  orientacoes: OrientacaoApp[];
  prefs: Preferencias;
}

const CHAVE_ESTADO = '@vittamed_estado';

export const ESTADO_INICIAL: Estado = {
  uid: null,
  usuario: null,
  sessao: false,
  lembrar: true,
  medicamentos: [],
  registros: [],
  orientacoes: [],
  prefs: { tamanho: 'normal', formato: 'som', lembretes: true, tema: 'claro' },
};

export const novoId = (prefixo: string): string =>
  `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const mesmoEmail = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

// Resultado das ações que falam com a API
export type Resultado =
  | { ok: true }
  | { ok: false; mensagem: string; semConexao: boolean };

// 'sem_perfil': entrou, mas a conta ainda não tem perfil (completar cadastro)
export type ResultadoEntrar = Resultado | { ok: true; semPerfil: true };

export type DadosPerfil = Omit<Usuario, 'email'>;

const falha = (erro: unknown, contexto: 'login' | 'registrar' | 'geral' = 'geral'): Resultado => {
  console.log(erro);
  return {
    ok: false,
    mensagem: api.mensagemErro(erro, contexto),
    semConexao: ehErroApi(erro) && erro.tipo === 'sem_conexao',
  };
};

// Perfil da API -> usuário do app. Gênero e foto ainda não existem na API,
// então ficam só no aparelho (mantidos se for a mesma conta).
function usuarioDoPerfil(p: api.Perfil, email: string, anterior: Usuario | null): Usuario {
  const mesmo = !!anterior && mesmoEmail(anterior.email, email);
  return {
    email,
    nome: p.nome,
    celular: p.telefone ?? (mesmo ? anterior.celular : ''),
    nascimento: p.data_nascimento ?? (mesmo ? anterior.nascimento : ''),
    genero: mesmo ? anterior.genero : '',
    foto: mesmo ? anterior.foto ?? null : null,
  };
}

function perfilDoUsuario(u: Usuario): api.Perfil {
  return {
    nome: u.nome,
    data_nascimento: u.nascimento || null,
    telefone: u.celular || null,
    email: u.email || null,
  };
}

// Os dados locais são de outra conta? (outra pessoa entrou neste aparelho)
function dadosDeOutraConta(e: Estado, uid: string, email: string): boolean {
  if (e.uid) return e.uid !== uid;
  // Dados do protótipo (antes da API): ficam com a conta do mesmo e-mail
  return !!e.usuario && !mesmoEmail(e.usuario.email, email);
}

interface Contexto {
  estado: Estado;
  hidratado: boolean;
  // Etapa 1 do cadastro: cria a conta na API (a sessão já fica ativa na API)
  criarConta: (email: string, senha: string) => Promise<Resultado>;
  // Etapa 2 (ou login de conta sem perfil): salva o perfil e entra no app
  concluirCadastro: (dados: DadosPerfil) => Promise<Resultado>;
  atualizarUsuario: (dados: Partial<DadosPerfil>) => Promise<Resultado>;
  entrar: (email: string, senha: string, lembrar: boolean) => Promise<ResultadoEntrar>;
  recuperarSenha: (email: string) => Promise<Resultado>;
  sair: () => void;
  atualizarPrefs: (prefs: Partial<Preferencias>) => void;
  salvarMedicamento: (med: Medicamento) => void;
  excluirMedicamento: (id: string) => void;
  registrarDose: (
    medicamentoId: string,
    horarioPrevisto: string,
    status: StatusDose,
    novoHorario?: string
  ) => void;
  salvarOrientacao: (o: OrientacaoApp) => void;
  excluirOrientacao: (id: string) => void;
  concluirOrientacao: (id: string) => void;
  sincronizar: () => Promise<void>;
}

const App = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const ctx = useContext(App);
  if (!ctx) throw new Error('useApp fora do ProvedorApp');
  return ctx;
}

export function ProvedorApp({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>(ESTADO_INICIAL);
  const [hidratado, setHidratado] = useState(false);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const fila = useRef<Promise<void>>(Promise.resolve());

  // Carrega o que foi salvo na última vez
  useEffect(() => {
    (async () => {
      try {
        const sessaoApi = await carregarSessao();
        await carregarSync();
        const bruto = await lerValor(CHAVE_ESTADO);
        const salvo = bruto ? (JSON.parse(bruto) as Partial<Estado>) : null;

        // Só continua logado com "Lembrar de mim" E tokens da API válidos.
        // Estado do protótipo (sem tokens) volta para o login.
        const continuar = !!salvo?.sessao && !!salvo.usuario && !!sessaoApi &&
          (!salvo.uid || salvo.uid === sessaoApi.uid);
        if (!continuar && sessaoApi) await limparSessao();
        if (continuar && salvo?.uid) prepararSync(salvo.uid);

        if (salvo) {
          // Versões antigas guardavam a senha no aparelho: descarta
          const usuario = salvo.usuario
            ? (({ senha: _senha, ...resto }) => resto)(salvo.usuario as Usuario & { senha?: string })
            : null;
          setEstado({
            ...ESTADO_INICIAL,
            ...salvo,
            usuario,
            prefs: { ...ESTADO_INICIAL.prefs, ...salvo.prefs },
            sessao: continuar,
          });
        }
      } catch (erro) {
        console.log(erro);
      } finally {
        setHidratado(true);
      }
    })();
  }, []);

  // Salva a cada mudança. Sem "Lembrar de mim", a sessão não vale na próxima abertura.
  useEffect(() => {
    if (!hidratado) return;
    salvarValor(
      CHAVE_ESTADO,
      JSON.stringify({ ...estado, sessao: estado.lembrar && estado.sessao })
    );
  }, [estado, hidratado]);

  // Recalcula todos os lembretes do sistema a partir do estado atual
  const sincronizar = useCallback((): Promise<void> => {
    fila.current = fila.current.then(async () => {
      const e = estadoRef.current;
      try {
        definirFormatoLembrete(e.prefs.formato);
        if (!e.sessao || !e.prefs.lembretes) {
          await cancelarTodosLembretes();
          await cancelarLembretesAdiados();
          await cancelarLembretesOrientacao();
          return;
        }
        const registradas = new Set(
          e.registros.map((r) => chaveDose(r.medicamento_id, r.horario_previsto))
        );
        await reagendarTodos(e.medicamentos, new Date(), (med, horario) =>
          registradas.has(chaveDose(med.id, horario))
        );
        await reagendarOrientacoes(e.orientacoes, e.medicamentos);
      } catch (erro) {
        console.log(erro);
      }
    });
    return fila.current;
  }, []);

  // Microtarefa 11: qualquer mudança em remédios, orientações ou preferências reagenda.
  // Registros também: uma dose marcada em outro aparelho não deve tocar aqui.
  useEffect(() => {
    if (hidratado) sincronizar();
  }, [
    hidratado,
    estado.sessao,
    estado.medicamentos,
    estado.registros,
    estado.orientacoes,
    estado.prefs.lembretes,
    estado.prefs.formato,
    sincronizar,
  ]);

  // Sincronização com a API: envia a fila e, quando pedido, baixa o que mudou
  // em outros aparelhos da mesma conta. Uma execução por vez; pedidos feitos
  // durante uma execução são atendidos logo em seguida.
  const syncRodando = useRef(false);
  const syncPendente = useRef<boolean | null>(null);
  const sincronizarApi = useCallback(async (baixar: boolean): Promise<void> => {
    if (syncRodando.current) {
      syncPendente.current = (syncPendente.current ?? false) || baixar;
      return;
    }
    syncRodando.current = true;
    try {
      let pedido: boolean | null = baixar;
      while (pedido !== null) {
        const deveBaixar = pedido;
        syncPendente.current = null;
        const e = estadoRef.current;
        if (!e.sessao || !e.uid || !sessaoAtual()) break;

        reconciliar(e);
        const envio = await enviarFila(() => estadoRef.current);

        if (envio === 'ok' && deveBaixar) {
          try {
            const dados = await baixarDados();
            // Só junta com a fila vazia: senão uma mudança daqui ainda não chegou à API
            const agora = estadoRef.current;
            if (estadoSync().fila.length === 0 && agora.uid === e.uid) {
              const m = mesclar(agora, estadoSync(), dados);
              alterarSync((s) => ({ ...s, idsMed: m.idsMed, idsDose: m.idsDose, idsOri: m.idsOri }));
              setEstado((atual) =>
                atual.uid !== e.uid
                  ? atual
                  : {
                      ...atual,
                      medicamentos: m.medicamentos,
                      registros: m.registros,
                      orientacoes: m.orientacoes,
                    }
              );
            }
          } catch (erro) {
            console.log(erro); // sem internet: fica com a cópia local
          }
        }
        pedido = syncPendente.current;
      }
    } catch (erro) {
      console.log(erro);
    } finally {
      syncRodando.current = false;
    }
  }, []);

  // Ao abrir o app já logado e ao entrar: envia e baixa
  useEffect(() => {
    if (hidratado && estado.sessao && estado.uid) void sincronizarApi(true);
  }, [hidratado, estado.sessao, estado.uid, sincronizarApi]);

  // Aviso à família (RF09): registra o token de push deste aparelho na conta
  // ao entrar, ao abrir o app e quando o token muda
  useEffect(() => {
    if (!hidratado || !estado.sessao || !estado.uid) return;
    void registrarAparelho();
    return ouvirTrocaToken(() => void registrarAparelho());
  }, [hidratado, estado.sessao, estado.uid]);

  // Cada mudança em remédios ou doses: envia
  useEffect(() => {
    if (hidratado && estado.sessao) void sincronizarApi(false);
  }, [hidratado, estado.sessao, estado.medicamentos, estado.registros, estado.orientacoes, sincronizarApi]);

  // Microtarefa 10: reagenda ao abrir o app e ao voltar do segundo plano
  // (e aproveita para trocar dados com a API)
  useEffect(() => {
    if (!hidratado) return;
    const assinatura = AppState.addEventListener('change', (proximo) => {
      if (proximo === 'active') {
        sincronizar();
        void sincronizarApi(true);
        // A permissão pode ter sido liberada agora (ex.: nas configurações)
        if (estadoRef.current.sessao) void registrarAparelho();
      }
    });
    return () => assinatura.remove();
  }, [hidratado, sincronizar, sincronizarApi]);

  // Refresh token recusado pela API: volta ao login (os dados locais ficam)
  useEffect(
    () => aoExpirarSessao(() => setEstado((e) => ({ ...e, sessao: false }))),
    []
  );

  // "Lembrar de mim" escolhido no login, usado ao concluir o perfil
  const lembrarPendente = useRef(true);

  const acoes = useMemo(() => {
    const mudar = (fn: (e: Estado) => Estado) => setEstado((e) => fn(e));
    const OK: Resultado = { ok: true };

    // Entra no app. Se os dados locais forem de outra conta, começa do zero.
    const entrarNoApp = (uid: string, usuario: Usuario, lembrar: boolean) => {
      prepararSync(uid);
      mudar((e) => {
        const base = dadosDeOutraConta(e, uid, usuario.email)
          ? { ...e, medicamentos: [], registros: [], orientacoes: [] }
          : e;
        return { ...base, uid, usuario, sessao: true, lembrar };
      });
    };

    return {
      criarConta: async (email: string, senha: string): Promise<Resultado> => {
        try {
          await api.registrar(email, senha);
          lembrarPendente.current = true;
          return OK;
        } catch (erro) {
          return falha(erro, 'registrar');
        }
      },

      concluirCadastro: async (dados: DadosPerfil): Promise<Resultado> => {
        const sessao = sessaoAtual();
        if (!sessao) {
          return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.', semConexao: false };
        }
        const usuario: Usuario = { ...dados, email: sessao.email ?? '' };
        try {
          await api.salvarPerfil(perfilDoUsuario(usuario));
        } catch (erro) {
          return falha(erro);
        }
        entrarNoApp(sessao.uid, usuario, lembrarPendente.current);
        return OK;
      },

      // Nome, celular e nascimento vão para a API; gênero e foto ficam no aparelho
      atualizarUsuario: async (dados: Partial<DadosPerfil>): Promise<Resultado> => {
        const u = estadoRef.current.usuario;
        if (!u) return { ok: false, mensagem: 'Entre na sua conta para continuar.', semConexao: false };
        const novo = { ...u, ...dados };
        const mudouPerfil =
          novo.nome !== u.nome || novo.celular !== u.celular || novo.nascimento !== u.nascimento;
        if (mudouPerfil) {
          try {
            await api.salvarPerfil(perfilDoUsuario(novo));
          } catch (erro) {
            return falha(erro);
          }
        }
        mudar((e) => (e.usuario ? { ...e, usuario: { ...e.usuario, ...dados } } : e));
        return OK;
      },

      entrar: async (email: string, senha: string, lembrar: boolean): Promise<ResultadoEntrar> => {
        let sessao;
        try {
          sessao = await api.login(email, senha);
        } catch (erro) {
          return falha(erro, 'login');
        }
        const emailConta = sessao.email ?? email.trim();

        let perfil: api.Perfil | null;
        try {
          perfil = await api.lerPerfil();
        } catch (erro) {
          // A rede caiu logo depois do login: usa a cópia local se for desta conta
          const e = estadoRef.current;
          if (e.usuario && !dadosDeOutraConta(e, sessao.uid, emailConta)) {
            entrarNoApp(sessao.uid, { ...e.usuario, email: emailConta }, lembrar);
            return OK;
          }
          await limparSessao();
          return falha(erro);
        }

        if (!perfil) {
          lembrarPendente.current = lembrar;
          return { ok: true, semPerfil: true };
        }
        entrarNoApp(sessao.uid, usuarioDoPerfil(perfil, emailConta, estadoRef.current.usuario), lembrar);
        return OK;
      },

      recuperarSenha: async (email: string): Promise<Resultado> => {
        try {
          await api.recuperarSenha(email);
          return OK;
        } catch (erro) {
          return falha(erro);
        }
      },

      // Tira este aparelho dos avisos da conta e descarta os tokens.
      // Os dados locais ficam para quando esta conta voltar.
      sair: () => {
        const sessaoQueSai = sessaoAtual();
        void (async () => {
          await desregistrarAparelho().catch((erro) => console.log(erro));
          // Se outra conta já entrou nesse meio-tempo, não apaga a sessão dela
          if (sessaoAtual() === sessaoQueSai) await api.sair();
        })();
        mudar((e) => ({ ...e, sessao: false }));
      },

      atualizarPrefs: (prefs: Partial<Preferencias>) =>
        mudar((e) => ({ ...e, prefs: { ...e.prefs, ...prefs } })),

      salvarMedicamento: (med: Medicamento) => {
        void pedirPermissao(); // dentro de um clique, como o navegador exige
        mudar((e) => {
          const existe = e.medicamentos.some((m) => m.id === med.id);
          return {
            ...e,
            medicamentos: existe
              ? e.medicamentos.map((m) => (m.id === med.id ? med : m))
              : [...e.medicamentos, med],
          };
        });
        enfileirar({ tipo: 'med_salvar', medId: med.id });
      },

      excluirMedicamento: (id: string) => {
        void cancelarLembretesMedicamento(id);
        // Na API, excluir o remédio não apaga as orientações dele: apaga antes
        for (const o of estadoRef.current.orientacoes) {
          if (o.medicamento_id === id) enfileirar({ tipo: 'ori_excluir', oriId: o.id });
        }
        enfileirar({ tipo: 'med_excluir', medId: id });
        mudar((e) => ({
          ...e,
          medicamentos: e.medicamentos.filter((m) => m.id !== id),
          orientacoes: e.orientacoes.filter((o) => o.medicamento_id !== id),
        }));
      },

      registrarDose: (
        medicamentoId: string,
        horarioPrevisto: string,
        status: StatusDose,
        novoHorario?: string
      ) => {
        const med = estadoRef.current.medicamentos.find((m) => m.id === medicamentoId);
        const previsto = new Date(horarioPrevisto);
        const chave = chaveDose(medicamentoId, previsto);

        mudar((e) => ({
          ...e,
          registros: [
            ...e.registros.filter((r) => chaveDose(r.medicamento_id, r.horario_previsto) !== chave),
            {
              id: novoId('d'),
              medicamento_id: medicamentoId,
              horario_previsto: previsto.toISOString(),
              status,
              horario_registrado: new Date().toISOString(),
              novo_horario: novoHorario ?? null,
            },
          ],
        }));
        enfileirar({ tipo: 'dose', chave });

        // O lembrete original (e um adiamento anterior) não deve mais tocar
        void cancelarLembreteDose(medicamentoId, previsto).then(() => {
          if (status === 'adiada' && novoHorario && med && estadoRef.current.prefs.lembretes) {
            void agendarLembreteAdiado(med, previsto, new Date(novoHorario));
          }
        });
      },

      salvarOrientacao: (o: OrientacaoApp) => {
        mudar((e) => ({
          ...e,
          orientacoes: e.orientacoes.some((x) => x.id === o.id)
            ? e.orientacoes.map((x) => (x.id === o.id ? o : x))
            : [...e.orientacoes, o],
        }));
        enfileirar({ tipo: 'ori_salvar', oriId: o.id });
      },

      excluirOrientacao: (id: string) => {
        mudar((e) => ({ ...e, orientacoes: e.orientacoes.filter((o) => o.id !== id) }));
        enfileirar({ tipo: 'ori_excluir', oriId: id });
      },

      concluirOrientacao: (id: string) => {
        mudar((e) => ({
          ...e,
          orientacoes: e.orientacoes.map((o) => (o.id === id ? { ...o, concluida: true } : o)),
        }));
        enfileirar({ tipo: 'ori_salvar', oriId: id });
      },
    };
  }, []);

  const valor = useMemo<Contexto>(
    () => ({ estado, hidratado, sincronizar, ...acoes }),
    [estado, hidratado, sincronizar, acoes]
  );

  return <App.Provider value={valor}>{children}</App.Provider>;
}
