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
import type { Medicamento, Orientacao, StatusDose } from '../notificacoes/tipos';
import { chaveDose, type Registro } from './doses';

export type TamanhoTexto = 'normal' | 'grande' | 'muito_grande';
export type TemaApp = 'claro' | 'escuro';

export interface Usuario {
  email: string;
  senha: string;
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

interface Contexto {
  estado: Estado;
  hidratado: boolean;
  criarConta: (usuario: Usuario) => void;
  atualizarUsuario: (dados: Partial<Usuario>) => void;
  entrar: (email: string, senha: string, lembrar: boolean) => 'ok' | 'sem_conta' | 'senha_errada';
  contaExiste: (email: string) => boolean;
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
        const bruto = await lerValor(CHAVE_ESTADO);
        if (bruto) {
          const salvo = JSON.parse(bruto) as Partial<Estado>;
          setEstado({
            ...ESTADO_INICIAL,
            ...salvo,
            prefs: { ...ESTADO_INICIAL.prefs, ...salvo.prefs },
            sessao: !!salvo.sessao && !!salvo.usuario,
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

  // Microtarefa 11: qualquer mudança em remédios, orientações ou preferências reagenda
  useEffect(() => {
    if (hidratado) sincronizar();
  }, [
    hidratado,
    estado.sessao,
    estado.medicamentos,
    estado.orientacoes,
    estado.prefs.lembretes,
    estado.prefs.formato,
    sincronizar,
  ]);

  // Microtarefa 10: reagenda ao abrir o app e ao voltar do segundo plano
  useEffect(() => {
    if (!hidratado) return;
    const assinatura = AppState.addEventListener('change', (proximo) => {
      if (proximo === 'active') sincronizar();
    });
    return () => assinatura.remove();
  }, [hidratado, sincronizar]);

  const acoes = useMemo(() => {
    const mudar = (fn: (e: Estado) => Estado) => setEstado((e) => fn(e));

    return {
      criarConta: (usuario: Usuario) =>
        mudar((e) => ({ ...e, usuario, sessao: true, lembrar: true })),

      atualizarUsuario: (dados: Partial<Usuario>) =>
        mudar((e) => (e.usuario ? { ...e, usuario: { ...e.usuario, ...dados } } : e)),

      contaExiste: (email: string) =>
        !!estadoRef.current.usuario && mesmoEmail(estadoRef.current.usuario.email, email),

      entrar: (email: string, senha: string, lembrar: boolean) => {
        const u = estadoRef.current.usuario;
        if (!u || !mesmoEmail(u.email, email)) return 'sem_conta' as const;
        if (u.senha !== senha) return 'senha_errada' as const;
        mudar((e) => ({ ...e, sessao: true, lembrar }));
        return 'ok' as const;
      },

      sair: () => mudar((e) => ({ ...e, sessao: false })),

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
      },

      excluirMedicamento: (id: string) => {
        void cancelarLembretesMedicamento(id);
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

        // O lembrete original (e um adiamento anterior) não deve mais tocar
        void cancelarLembreteDose(medicamentoId, previsto).then(() => {
          if (status === 'adiada' && novoHorario && med && estadoRef.current.prefs.lembretes) {
            void agendarLembreteAdiado(med, previsto, new Date(novoHorario));
          }
        });
      },

      salvarOrientacao: (o: OrientacaoApp) =>
        mudar((e) => ({
          ...e,
          orientacoes: e.orientacoes.some((x) => x.id === o.id)
            ? e.orientacoes.map((x) => (x.id === o.id ? o : x))
            : [...e.orientacoes, o],
        })),

      excluirOrientacao: (id: string) =>
        mudar((e) => ({ ...e, orientacoes: e.orientacoes.filter((o) => o.id !== id) })),

      concluirOrientacao: (id: string) =>
        mudar((e) => ({
          ...e,
          orientacoes: e.orientacoes.map((o) => (o.id === id ? { ...o, concluida: true } : o)),
        })),
    };
  }, []);

  const valor = useMemo<Contexto>(
    () => ({ estado, hidratado, sincronizar, ...acoes }),
    [estado, hidratado, sincronizar, acoes]
  );

  return <App.Provider value={valor}>{children}</App.Provider>;
}
