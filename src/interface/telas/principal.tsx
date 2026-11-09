// Início, calendário mensal, histórico diário, assistente e avisos do perfil compartilhado.

import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { formatarHora } from '../../notificacoes/textos';
import { AVISO_ASSISTENTE, responderAssistente } from '../assistente';
import {
  DIAS_CURTOS,
  chaveData,
  dataCompleta,
  dataDeChave,
  dataLonga,
  gradeDoMes,
  inicioDoDia,
  mesAno,
  mesmoDia,
  saudacao,
  semanaDe,
  somarDias,
} from '../datas';
import {
  dosesDoDia,
  letraStatus,
  letrasDoDia,
  medicamentoFinalizado,
  orientacaoVencida,
  textoStatus,
  type DoseDia,
} from '../doses';
import { useApp } from '../estado';
import { Botao, Cartao, Iniciais, Pagina, T, Voltar, useNav, useTema } from '../ui';

// ---------- Início ----------

function textoDaDose(d: DoseDia): { texto: string; cor: 'sucesso' | 'perigo' | 'alerta' | 'suave' } {
  if (d.status === 'tomada') return { texto: '✓ Tomado', cor: 'sucesso' };
  if (d.status === 'nao_tomada') return { texto: 'Não tomado', cor: 'perigo' };
  if (d.status === 'adiada') {
    const novo = d.registro?.novo_horario ? formatarHora(new Date(d.registro.novo_horario)) : '';
    return { texto: `Adiada para ${novo}`, cor: 'alerta' };
  }
  return d.horario > new Date() ? { texto: 'Mais tarde', cor: 'suave' } : { texto: 'Sem registro', cor: 'alerta' };
}

export function TelaInicio() {
  const { estado, registrarDose } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const hoje = inicioDoDia(new Date());
  const [dia, setDia] = useState(hoje);

  const doses = dosesDoDia(estado.medicamentos, estado.registros, dia);
  const proxima = doses.find((d) => d.status === 'pendente' && mesmoDia(dia, hoje) && d.horario > new Date(Date.now() - 60 * 60 * 1000));
  const nome = estado.usuario?.nome.split(' ')[0] ?? '';
  const semana = semanaDe(dia);

  return (
    <Pagina>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <T v="subtitulo" cor="texto" negrito style={{ letterSpacing: 1 }}>VITTAMED</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir assistente de IA" onPress={() => nav.ir({ nome: 'assistente' })} style={{ backgroundColor: c.suaveFundo, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <T v="pequeno" cor="primaria" negrito>💬 IA</T>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <Iniciais nome={estado.usuario?.nome ?? ''} tamanho={44} foto={estado.usuario?.foto} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <T v="pequeno" cor="suave">{saudacao()}</T>
          <T v="subtitulo">{nome}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Avisos" onPress={() => nav.ir({ nome: 'avisos' })} style={{ padding: 8 }}>
          <T>🔔</T>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <T v="rotulo">{mesAno(dia)}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendário mensal" onPress={() => nav.ir({ nome: 'calendario', dia: chaveData(dia) })} style={{ padding: 6 }}>
          <T>📅</T>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        {semana.map((d, i) => {
          const marcado = mesmoDia(d, dia);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={dataCompleta(d)}
              onPress={() => setDia(d)}
              style={{ alignItems: 'center', width: 42, paddingVertical: 6, borderRadius: 12, backgroundColor: marcado ? c.primaria : 'transparent' }}
            >
              <T v="pequeno" style={{ color: marcado ? c.sobrePrimaria : c.suave, fontSize: 11 }}>{DIAS_CURTOS[i]}</T>
              <T negrito style={{ color: marcado ? c.sobrePrimaria : c.texto }}>{d.getDate()}</T>
            </Pressable>
          );
        })}
      </View>

      <T v="subtitulo" style={{ marginBottom: 10 }}>
        {mesmoDia(dia, hoje) ? `Hoje, ${dataLonga(dia)}` : dataLonga(dia)}
      </T>

      {estado.medicamentos.length === 0 && (
        <Cartao>
          <T negrito style={{ marginBottom: 4 }}>Nenhum remédio cadastrado</T>
          <T v="pequeno" cor="suave" style={{ marginBottom: 10 }}>Cadastre seu primeiro remédio para receber os lembretes na hora certa.</T>
          <Botao titulo="Adicionar remédio" onPress={() => nav.ir({ nome: 'dadosRemedio' })} />
        </Cartao>
      )}
      {estado.medicamentos.length > 0 && doses.length === 0 && (
        <Cartao><T v="pequeno" cor="suave">Nenhuma dose programada para este dia.</T></Cartao>
      )}

      {doses.map((d) => {
        const destaque = d === proxima;
        const st = textoDaDose(d);
        return (
          <Cartao key={`${d.med.id}${d.horario.getTime()}`} destaque={destaque}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${d.med.nome} às ${formatarHora(d.horario)}`}
              onPress={() => nav.ir({ nome: 'horaRemedio', medId: d.med.id, horario: d.horario.toISOString() })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.suaveFundo, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <T>💊</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T negrito>{[d.med.nome, d.med.dosagem].filter(Boolean).join(' ')}</T>
                  {!!d.med.forma_uso && <T v="pequeno" cor="suave">{d.med.forma_uso}</T>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <T v="pequeno" cor="suave">🕒 {formatarHora(d.horario)}</T>
                <T v="pequeno" cor={st.cor} negrito>{destaque ? `Próxima dose · ${formatarHora(d.horario)}` : st.texto}</T>
              </View>
            </Pressable>
            {destaque && (
              <Botao
                titulo="✓ Marcar como tomado"
                style={{ marginTop: 10, marginBottom: 0 }}
                onPress={() => registrarDose(d.med.id, d.horario.toISOString(), 'tomada')}
              />
            )}
          </Cartao>
        );
      })}

      <T v="rotulo" style={{ marginTop: 8, marginBottom: 8 }}>Acessos rápidos</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { t: 'Histórico', s: 'Ver doses passadas', i: '📋', r: { nome: 'historico' } as const },
          { t: 'Avisos', s: 'Compartilhados', i: '🔔', r: { nome: 'avisos' } as const },
          { t: 'Assistente', s: 'Ajuda e orientações', i: '💬', r: { nome: 'assistente' } as const },
        ].map((a) => (
          <Pressable
            key={a.t}
            accessibilityRole="button"
            accessibilityLabel={`${a.t}: ${a.s}`}
            onPress={() => nav.ir(a.r)}
            style={{ flex: 1, backgroundColor: c.superficie, borderRadius: 12, borderWidth: 1, borderColor: c.borda, padding: 10 }}
          >
            <T>{a.i}</T>
            <T v="pequeno" negrito>{a.t}</T>
            <T v="pequeno" cor="suave" style={{ fontSize: 11 }}>{a.s}</T>
          </Pressable>
        ))}
      </View>
    </Pagina>
  );
}

// ---------- Calendário mensal ----------

export function TelaCalendario({ dia }: { dia?: string }) {
  const { estado } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const hoje = inicioDoDia(new Date());
  const inicial = dataDeChave(dia) ?? hoje;
  const [mes, setMes] = useState(new Date(inicial.getFullYear(), inicial.getMonth(), 1));
  const [selecionado, setSelecionado] = useState(inicial);

  const grade = gradeDoMes(mes.getFullYear(), mes.getMonth());
  const doses = dosesDoDia(estado.medicamentos, estado.registros, selecionado);
  const finalizados = estado.medicamentos.filter((m) => medicamentoFinalizado(m));

  return (
    <Pagina>
      <Voltar texto="Histórico diário" onPress={() => nav.ir({ nome: 'historico', dia: chaveData(selecionado) })} />
      <T v="titulo" style={{ marginBottom: 12 }}>Calendário mensal</T>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.suaveFundo, borderRadius: 12, marginBottom: 12 }}>
        <Pressable accessibilityLabel="Mês anterior" onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} style={{ padding: 12 }}>
          <T cor="primaria" negrito>‹</T>
        </Pressable>
        <T negrito cor="primaria">{mesAno(mes)}</T>
        <Pressable accessibilityLabel="Próximo mês" onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} style={{ padding: 12 }}>
          <T cor="primaria" negrito>›</T>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {DIAS_CURTOS.map((n) => (
          <View key={n} style={{ flex: 1, alignItems: 'center' }}><T v="pequeno" cor="suave" style={{ fontSize: 11 }}>{n}</T></View>
        ))}
      </View>
      {grade.map((semana, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {semana.map((d, j) => {
            if (!d) return <View key={j} style={{ flex: 1, height: 46, margin: 1 }} />;
            const marcado = mesmoDia(d, selecionado);
            const letras = letrasDoDia(estado.registros, d);
            return (
              <Pressable
                key={j}
                accessibilityRole="button"
                accessibilityLabel={`${dataCompleta(d)}${letras.length ? ', registros ' + letras.join(' ') : ''}`}
                onPress={() => setSelecionado(d)}
                style={{ flex: 1, height: 46, margin: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: marcado ? c.primaria : mesmoDia(d, hoje) ? c.suaveFundo : c.campo }}
              >
                <T v="pequeno" negrito style={{ color: marcado ? c.sobrePrimaria : c.texto }}>{d.getDate()}</T>
                {letras.length > 0 && (
                  <T v="pequeno" style={{ fontSize: 9, lineHeight: 11, color: marcado ? c.sobrePrimaria : c.primaria }}>{letras.join(' ')}</T>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <T v="pequeno" cor="suave" style={{ marginVertical: 10 }}>
        Legenda: T — Tomada; N — Não tomada; A — Adiada. Dias sem letras: sem registro nesta prévia.
      </T>

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 6 }}>Selecionado • {dataLonga(selecionado)}</T>
        {doses.length === 0 && <T v="pequeno" cor="suave">Nenhuma dose neste dia.</T>}
        {doses.map((d) => (
          <T key={`${d.med.id}${d.horario.getTime()}`} v="pequeno" style={{ marginBottom: 2 }}>
            {formatarHora(d.horario)} • {d.med.nome} — {textoStatus(d.status)}
          </T>
        ))}
        <Botao titulo="Abrir diário deste dia" v="link" onPress={() => nav.ir({ nome: 'historico', dia: chaveData(selecionado) })} />
      </Cartao>

      <T v="subtitulo" style={{ marginTop: 8, marginBottom: 8 }}>Remédios finalizados</T>
      {finalizados.length === 0 && <T v="pequeno" cor="suave">Nenhum remédio finalizado.</T>}
      {finalizados.map((m) => (
        <Cartao key={m.id}>
          <T negrito>{[m.nome, m.dosagem].filter(Boolean).join(' ')}</T>
          <T v="pequeno" style={{ marginVertical: 4 }}>
            Período: {m.periodo_inicio?.split('-').reverse().join('/')} a {m.periodo_fim?.split('-').reverse().join('/')}.
          </T>
          <T v="pequeno" cor="primaria" negrito>No histórico · Lembretes encerrados</T>
        </Cartao>
      ))}
    </Pagina>
  );
}

// ---------- Histórico diário ----------

export function TelaHistorico({ dia }: { dia?: string }) {
  const { estado } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const [atual, setAtual] = useState(dataDeChave(dia) ?? inicioDoDia(new Date()));
  const doses = dosesDoDia(estado.medicamentos, estado.registros, atual);
  const registradas = doses.filter((d) => d.status !== 'pendente').length;

  return (
    <Pagina>
      <Voltar texto="Início" onPress={() => nav.raiz({ nome: 'inicio' })} />
      <T v="titulo" style={{ marginBottom: 12 }}>Histórico diário</T>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.suaveFundo, borderRadius: 12, marginBottom: 12 }}>
        <Pressable accessibilityLabel="Dia anterior" onPress={() => setAtual(somarDias(atual, -1))} style={{ padding: 12 }}><T cor="primaria" negrito>‹</T></Pressable>
        <T negrito cor="primaria">{dataCompleta(atual)}</T>
        <Pressable accessibilityLabel="Próximo dia" onPress={() => setAtual(somarDias(atual, 1))} style={{ padding: 12 }}><T cor="primaria" negrito>›</T></Pressable>
      </View>

      <T v="pequeno" cor="suave" style={{ marginBottom: 10 }}>
        {estado.usuario?.nome} • {registradas} {registradas === 1 ? 'registro' : 'registros'} no dia
      </T>

      {doses.length === 0 && <Cartao><T v="pequeno" cor="suave">Nenhuma dose neste dia.</T></Cartao>}
      {doses.map((d) => {
        const letra = letraStatus(d.status);
        return (
          <Cartao key={`${d.med.id}${d.horario.getTime()}`}>
            <Pressable onPress={() => nav.ir({ nome: 'horaRemedio', medId: d.med.id, horario: d.horario.toISOString() })} accessibilityRole="button">
              <T negrito>{[d.med.nome, d.med.dosagem].filter(Boolean).join(' ')}</T>
              <T v="pequeno" style={{ marginVertical: 2 }}>
                {formatarHora(d.horario)}{d.med.forma_uso ? ` • ${d.med.forma_uso}` : ''}
              </T>
              <T v="pequeno" cor={d.status === 'tomada' ? 'sucesso' : d.status === 'nao_tomada' ? 'perigo' : d.status === 'adiada' ? 'alerta' : 'suave'} negrito>
                {letra ? `${letra} • ` : ''}
                {d.status === 'adiada' && d.registro?.novo_horario
                  ? `Adiada para ${formatarHora(new Date(d.registro.novo_horario))}`
                  : textoStatus(d.status)}
              </T>
              {d.status === 'nao_tomada' && <T v="pequeno" cor="suave">Aviso no perfil compartilhado.</T>}
            </Pressable>
          </Cartao>
        );
      })}

      <T v="pequeno" cor="suave" style={{ marginBottom: 12 }}>Legenda: T — Tomada; N — Não tomada; A — Adiada.</T>
      <Botao titulo="Ver calendário mensal" onPress={() => nav.ir({ nome: 'calendario', dia: chaveData(atual) })} />
    </Pagina>
  );
}

// ---------- Assistente de IA ----------

interface Mensagem { de: 'eu' | 'ia'; texto: string }

export function TelaAssistente() {
  const { estado } = useApp();
  const nav = useNav();
  const { c, escala } = useTema();
  const n = estado.medicamentos.length;
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');

  const enviar = () => {
    const pergunta = texto.trim();
    if (!pergunta) return;
    const resposta = responderAssistente(pergunta, estado.medicamentos, estado.registros);
    setMensagens((m) => [...m, { de: 'eu', texto: pergunta }, { de: 'ia', texto: resposta }]);
    setTexto('');
  };

  return (
    <Pagina>
      <Voltar texto="Início" onPress={() => nav.raiz({ nome: 'inicio' })} />
      <T v="titulo" style={{ marginBottom: 12 }}>Assistente de IA</T>

      <Cartao>
        <T v="pequeno">
          {n === 0
            ? 'Você ainda não tem remédios cadastrados.'
            : `${n} ${n === 1 ? 'medicamento cadastrado' : 'medicamentos cadastrados'}: ${estado.medicamentos.map((m) => [m.nome, m.dosagem].filter(Boolean).join(' ')).join(', ')}`}
        </T>
      </Cartao>

      {mensagens.map((m, i) => (
        <View key={i} style={{ alignSelf: m.de === 'eu' ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 10 }}>
          <T v="pequeno" cor="primaria" negrito style={{ textAlign: m.de === 'eu' ? 'right' : 'left' }}>{m.de === 'eu' ? 'Você' : 'Assistente de IA'}</T>
          <View style={{ backgroundColor: m.de === 'eu' ? c.suaveFundo : c.superficie, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.borda }}>
            <T>{m.texto}</T>
          </View>
        </View>
      ))}

      <Cartao>
        <T v="pequeno" negrito>{AVISO_ASSISTENTE}</T>
        <T v="pequeno" cor="suave" style={{ marginTop: 4 }}>
          Dúvidas sobre dose, interações, efeitos adversos, interrupção ou alteração do tratamento devem ser encaminhadas a médico ou farmacêutico.
        </T>
      </Cartao>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          accessibilityLabel="Digite sua dúvida"
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={enviar}
          placeholder="Digite sua dúvida"
          placeholderTextColor={c.suave}
          style={{ flex: 1, backgroundColor: c.campo, borderRadius: 10, borderWidth: 1, borderColor: c.borda, color: c.texto, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 * escala }}
        />
        <Botao titulo="Enviar" onPress={enviar} style={{ marginBottom: 0 }} />
      </View>
    </Pagina>
  );
}

// ---------- Avisos do perfil compartilhado ----------

export function TelaAvisos() {
  const { estado } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const u = estado.usuario;

  const naoTomada = [...estado.registros]
    .filter((r) => r.status === 'nao_tomada')
    .sort((a, b) => b.horario_previsto.localeCompare(a.horario_previsto))[0];
  const medNaoTomada = naoTomada && estado.medicamentos.find((m) => m.id === naoTomada.medicamento_id);
  const vencidas = estado.orientacoes.filter((o) => orientacaoVencida(o));

  return (
    <Pagina>
      <Voltar texto="Início" onPress={() => nav.raiz({ nome: 'inicio' })} />
      <T v="titulo" style={{ marginBottom: 12 }}>Avisos do perfil compartilhado</T>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Iniciais nome={u?.nome ?? ''} tamanho={40} foto={u?.foto} />
        <View style={{ marginLeft: 10 }}>
          <T negrito>{u?.nome}</T>
          <T v="pequeno" cor="suave">único paciente</T>
        </View>
      </View>
      <T v="pequeno" style={{ marginBottom: 14 }}>
        Familiares e cuidadores veem estes avisos ao entrar com o mesmo e-mail e senha da conta. Não são enviados por SMS nem para contatos individuais.
      </T>

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 6 }}>Dose não tomada</T>
        {naoTomada && medNaoTomada ? (
          <>
            <T v="pequeno">
              {new Date(naoTomada.horario_previsto).toLocaleDateString('pt-BR')} • {formatarHora(new Date(naoTomada.horario_previsto))}
            </T>
            <T v="pequeno">{[medNaoTomada.nome, medNaoTomada.dosagem].filter(Boolean).join(' ')} • Não tomada</T>
            <T v="pequeno" cor="suave" style={{ marginVertical: 6 }}>Aviso disponível nesta conta compartilhada.</T>
            <Botao titulo="Ver histórico do dia" v="link" onPress={() => nav.ir({ nome: 'historico', dia: chaveData(new Date(naoTomada.horario_previsto)) })} />
          </>
        ) : (
          <T v="pequeno" cor="suave">Nenhuma dose marcada como não tomada.</T>
        )}
      </Cartao>

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 6 }}>Orientação vencida</T>
        {vencidas.length === 0 && <T v="pequeno" cor="suave">Nenhuma orientação vencida.</T>}
        {vencidas.map((o) => {
          const med = estado.medicamentos.find((m) => m.id === o.medicamento_id);
          return (
            <View key={o.id} style={{ marginBottom: 8 }}>
              <T v="pequeno">{med?.nome} • validade até {o.validade?.split('-').reverse().join('/')}</T>
              <T v="pequeno" cor="primaria" negrito>Revisão pendente · Continua ativa</T>
              <T v="pequeno" cor="suave" style={{ marginVertical: 4 }}>Revisar a orientação. Ela permanece ativa até concluir ou excluir.</T>
              <Botao titulo="Revisar orientação" onPress={() => nav.ir({ nome: 'orientacoes', medId: o.medicamento_id })} />
            </View>
          );
        })}
      </Cartao>
    </Pagina>
  );
}
