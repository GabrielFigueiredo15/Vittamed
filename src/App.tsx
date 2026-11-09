// Vittamed: navegação, abas e tratamento do toque nas notificações.
// Telas em src/app/telas; lembretes em src/notificacoes.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, StatusBar, View } from 'react-native';

import { ProvedorApp, useApp } from './interface/estado';
import {
  ContextoNavegacao,
  T,
  useTema,
  type Navegacao,
  type Rota,
} from './interface/ui';
import {
  TelaCompletarPerfil,
  TelaCriarConta,
  TelaLogin,
  TelaRecuperarSenha,
  TelaSemConexao,
} from './interface/telas/autenticacao';
import {
  TelaAssistente,
  TelaAvisos,
  TelaCalendario,
  TelaHistorico,
  TelaInicio,
} from './interface/telas/principal';
import {
  TelaDadosOrientacao,
  TelaDadosRemedio,
  TelaDetalhes,
  TelaHoraRemedio,
  TelaOrientacoes,
  TelaProgramar,
  TelaRemedios,
} from './interface/telas/remedios';
import { TelaAcessibilidade, TelaPerfil } from './interface/telas/perfil';
import { ACAO_ADIAR, ACAO_NAO_TOMEI, ACAO_TOMEI, MINUTOS_ADIAR } from './notificacoes/constantes';
import { ouvirToque } from './notificacoes/notificador';
import { minutosDepois } from './interface/datas';

type Aba = 'inicio' | 'remedios' | 'perfil';

const ABA_DA_ROTA: Partial<Record<Rota['nome'], Aba>> = {
  inicio: 'inicio',
  calendario: 'inicio',
  historico: 'inicio',
  assistente: 'inicio',
  avisos: 'inicio',
  horaRemedio: 'inicio',
  remedios: 'remedios',
  dadosRemedio: 'remedios',
  programar: 'remedios',
  detalhes: 'remedios',
  orientacoes: 'remedios',
  dadosOrientacao: 'remedios',
  perfil: 'perfil',
  acessibilidade: 'perfil',
  completarPerfil: 'perfil',
};

const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: 'inicio', nome: 'Início', icone: '🏠' },
  { id: 'remedios', nome: 'Remédios', icone: '💊' },
  { id: 'perfil', nome: 'Perfil', icone: '👤' },
];

function Tela({ rota }: { rota: Rota }) {
  switch (rota.nome) {
    case 'login': return <TelaLogin />;
    case 'criarConta': return <TelaCriarConta />;
    case 'completarPerfil': return <TelaCompletarPerfil email={rota.email} senha={rota.senha} editar={rota.editar} />;
    case 'recuperarSenha': return <TelaRecuperarSenha />;
    case 'semConexao': return <TelaSemConexao />;
    case 'inicio': return <TelaInicio />;
    case 'remedios': return <TelaRemedios />;
    case 'perfil': return <TelaPerfil />;
    case 'calendario': return <TelaCalendario dia={rota.dia} />;
    case 'historico': return <TelaHistorico dia={rota.dia} />;
    case 'assistente': return <TelaAssistente />;
    case 'avisos': return <TelaAvisos />;
    case 'acessibilidade': return <TelaAcessibilidade />;
    case 'dadosRemedio': return <TelaDadosRemedio id={rota.id} />;
    case 'programar': return <TelaProgramar medId={rota.medId} rascunho={rota.rascunho} />;
    case 'detalhes': return <TelaDetalhes id={rota.id} />;
    case 'horaRemedio': return <TelaHoraRemedio medId={rota.medId} horario={rota.horario} />;
    case 'orientacoes': return <TelaOrientacoes medId={rota.medId} />;
    case 'dadosOrientacao': return <TelaDadosOrientacao medId={rota.medId} id={rota.id} ver={rota.ver} />;
  }
}

function BarraAbas({ ativa, onTrocar }: { ativa: Aba | undefined; onTrocar: (a: Aba) => void }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.borda, backgroundColor: c.fundo, paddingVertical: 6, paddingHorizontal: 8 }}>
      {ABAS.map((a) => {
        const marcada = a.id === ativa;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: marcada }}
            accessibilityLabel={a.nome}
            onPress={() => onTrocar(a.id)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: marcada ? c.suaveFundo : 'transparent' }}
          >
            <T style={{ fontSize: 18 }}>{a.icone}</T>
            <T v="pequeno" cor={marcada ? 'primaria' : 'suave'} negrito={marcada} style={{ fontSize: 12 }}>{a.nome}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Raiz() {
  const { estado, hidratado, registrarDose } = useApp();
  const { c, escuro } = useTema();
  const [pilha, setPilha] = useState<Rota[]>([{ nome: 'login' }]);

  const ir = useCallback((r: Rota) => setPilha((p) => [...p, r]), []);
  const voltar = useCallback(() => setPilha((p) => (p.length > 1 ? p.slice(0, -1) : p)), []);
  const raiz = useCallback((r: Rota) => setPilha([r]), []);

  // Entrou ou saiu da conta: recomeça a navegação
  useEffect(() => {
    if (hidratado) setPilha([estado.sessao ? { nome: 'inicio' } : { nome: 'login' }]);
  }, [hidratado, estado.sessao]);

  // Botão voltar do Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pilha.length > 1) {
        voltar();
        return true;
      }
      return false;
    });
    return () => assinatura.remove();
  }, [pilha.length, voltar]);

  // Toque na notificação (ou nos botões Tomei / Adiar / Não tomei)
  useEffect(() => {
    if (!hidratado || !estado.sessao) return;
    return ouvirToque((dados, acao) => {
      if (!dados) return;
      if (dados.tipo === 'orientacao') {
        raiz({ nome: 'orientacoes', medId: dados.medicamentoId });
        return;
      }
      const { medicamentoId, horarioPrevisto } = dados;
      if (acao === ACAO_TOMEI) {
        registrarDose(medicamentoId, horarioPrevisto, 'tomada');
        raiz({ nome: 'inicio' });
      } else if (acao === ACAO_NAO_TOMEI) {
        registrarDose(medicamentoId, horarioPrevisto, 'nao_tomada');
        raiz({ nome: 'inicio' });
      } else if (acao === ACAO_ADIAR) {
        registrarDose(medicamentoId, horarioPrevisto, 'adiada', minutosDepois(new Date(), MINUTOS_ADIAR).toISOString());
        raiz({ nome: 'inicio' });
      } else {
        raiz({ nome: 'horaRemedio', medId: medicamentoId, horario: horarioPrevisto });
      }
    });
  }, [hidratado, estado.sessao, registrarDose, raiz]);

  const rota = pilha[pilha.length - 1];
  const nav = useMemo<Navegacao>(() => ({ rota, ir, voltar, raiz }), [rota, ir, voltar, raiz]);

  const topo = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : Platform.OS === 'ios' ? 48 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.pagina, alignItems: 'center' }}>
      <StatusBar barStyle={escuro ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: c.fundo, paddingTop: topo }}>
        {hidratado ? (
          <ContextoNavegacao.Provider value={nav}>
            <View style={{ flex: 1 }}>
              <Tela key={pilha.length + rota.nome} rota={rota} />
            </View>
            {estado.sessao && (
              <BarraAbas ativa={ABA_DA_ROTA[rota.nome]} onTrocar={(a) => raiz({ nome: a })} />
            )}
          </ContextoNavegacao.Provider>
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ProvedorApp>
      <Raiz />
    </ProvedorApp>
  );
}
