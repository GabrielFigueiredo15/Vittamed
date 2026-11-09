// Remédios: lista, cadastro em duas etapas, detalhes, hora do remédio e orientações de uso.

import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { formatarHora } from '../../notificacoes/textos';
import type { Agendamento, Medicamento } from '../../notificacoes/tipos';
import { MINUTOS_ADIAR } from '../../notificacoes/constantes';
import {
  brParaChave,
  chaveData,
  chaveParaBR,
  DIAS_CURTOS,
  horaValida,
  mascaraData,
  mascaraHora,
  minutosDepois,
} from '../datas';
import { orientacaoVencida, resumoDias, resumoHorarios, textoStatus } from '../doses';
import { novoId, useApp, type OrientacaoApp } from '../estado';
import { escolherFoto } from '../foto';
import {
  Botao,
  Cartao,
  Campo,
  ConfirmarExclusao,
  FotoEmbalagem,
  LinhaPilulas,
  Opcao,
  Pagina,
  Pilula,
  T,
  Voltar,
  avisar,
  confirmar,
  useNav,
  useTema,
  type RascunhoRemedio,
} from '../ui';

const nomeCompleto = (m: Medicamento): string => [m.nome, m.dosagem].filter(Boolean).join(' ');

// ---------- Lista ----------

export function TelaRemedios() {
  const { estado, excluirMedicamento } = useApp();
  const nav = useNav();
  const { c, escala } = useTema();
  const [busca, setBusca] = useState('');
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const lista = estado.medicamentos.filter((m) =>
    m.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <Pagina>
      <T v="titulo">Meus remédios</T>
      <T v="pequeno" cor="suave" style={{ marginBottom: 12 }}>
        {estado.medicamentos.length} {estado.medicamentos.length === 1 ? 'remédio cadastrado' : 'remédios cadastrados'}
      </T>

      <Botao titulo="+ Adicionar remédio" v="suave" onPress={() => nav.ir({ nome: 'dadosRemedio' })} />
      <TextInput
        accessibilityLabel="Buscar remédio"
        value={busca}
        onChangeText={setBusca}
        placeholder="🔍 Buscar remédio"
        placeholderTextColor={c.suave}
        style={{ backgroundColor: c.campo, borderRadius: 10, borderWidth: 1, borderColor: c.borda, color: c.texto, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 * escala, marginBottom: 14 }}
      />

      {estado.medicamentos.length === 0 && (
        <Cartao><T v="pequeno" cor="suave">Nenhum remédio ainda. Toque em "Adicionar remédio" para começar.</T></Cartao>
      )}
      {estado.medicamentos.length > 0 && lista.length === 0 && (
        <T v="pequeno" cor="suave">Nenhum remédio encontrado para "{busca}".</T>
      )}

      {lista.map((m) => (
        <Cartao key={m.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.suaveFundo, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <T>💊</T>
            </View>
            <View style={{ flex: 1 }}>
              <T negrito>{nomeCompleto(m)}</T>
              {!!m.forma_uso && <T v="pequeno" cor="suave">{m.forma_uso}</T>}
            </View>
          </View>
          <T v="pequeno">🕒 {resumoHorarios(m)} · {resumoDias(m)}</T>
          <T v="pequeno" cor="suave" style={{ marginBottom: 10 }}>
            {estado.prefs.lembretes ? '🔔 Lembrete ativado' : '🔕 Lembretes desligados'}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao titulo="Detalhes" v="contorno" pequeno style={{ flex: 1, marginBottom: 0 }} onPress={() => nav.ir({ nome: 'detalhes', id: m.id })} />
            <Botao titulo="Editar" v="suave" pequeno style={{ flex: 1, marginBottom: 0 }} onPress={() => nav.ir({ nome: 'dadosRemedio', id: m.id })} />
            <Botao titulo="Excluir" v="contorno" pequeno style={{ flex: 1, marginBottom: 0 }} onPress={() => setExcluindo(m.id)} />
          </View>
          {excluindo === m.id && (
            <View style={{ marginTop: 10 }}>
              <ConfirmarExclusao
                titulo="Ao excluir • confirmação"
                texto={`Excluir ${m.nome}? Remover o medicamento encerra seus lembretes. O histórico das doses é mantido.`}
                rotuloConfirmar="Excluir medicamento"
                onConfirmar={() => { excluirMedicamento(m.id); setExcluindo(null); }}
                onCancelar={() => setExcluindo(null)}
              />
            </View>
          )}
        </Cartao>
      ))}
    </Pagina>
  );
}

// ---------- Cadastro: etapa 1 ----------

export function TelaDadosRemedio({ id }: { id?: string }) {
  const { estado } = useApp();
  const nav = useNav();
  const existente = estado.medicamentos.find((m) => m.id === id);
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [dosagem, setDosagem] = useState(existente?.dosagem ?? '');
  const [forma, setForma] = useState(existente?.forma_uso ?? '');
  const [obs, setObs] = useState(existente?.observacoes ?? '');
  const [foto, setFoto] = useState<string | null>(existente?.foto_url ?? null);
  const [erro, setErro] = useState('');

  const trocarFoto = async () => {
    try {
      const resultado = await escolherFoto(false);
      if (resultado === 'negada') avisar('Sem permissão', 'Libere o acesso às fotos nas configurações para escolher uma imagem.');
      else if (resultado) setFoto(resultado.uri);
    } catch (erro2) {
      console.log(erro2);
      avisar('Erro', 'Não foi possível abrir a galeria.');
    }
  };

  const continuar = () => {
    if (nome.trim().length < 2) return setErro('Digite o nome do remédio.');
    const rascunho: RascunhoRemedio = {
      nome: nome.trim(),
      dosagem: dosagem.trim(),
      forma_uso: forma.trim(),
      observacoes: obs.trim(),
      foto_url: foto,
    };
    nav.ir({ nome: 'programar', medId: existente?.id, rascunho });
  };

  return (
    <Pagina>
      <Voltar texto="Remédios" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 4 }}>Dados do remédio</T>
      <T cor="suave" style={{ marginBottom: 16 }}>
        {existente ? 'Altere os campos e continue.' : 'Cadastre ou edite o remédio.'} Etapa 1 de 2. Os dados devem seguir a receita.
      </T>

      <Campo rotulo="Nome" valor={nome} onChange={(t) => { setNome(t); setErro(''); }} placeholder="Losartana" autoCapitalize="words" erro={erro} />
      <Campo rotulo="Dosagem" valor={dosagem} onChange={setDosagem} placeholder="50 mg • 1 comprimido" />
      <Campo rotulo="Forma de uso" valor={forma} onChange={setForma} placeholder="Via oral" />

      <FotoEmbalagem uri={foto} />
      <Botao titulo="Adicionar / trocar foto" v="suave" onPress={trocarFoto} />
      {!!foto && <Botao titulo="Remover foto" v="link" onPress={() => setFoto(null)} />}


      <Campo rotulo="Observações" valor={obs} onChange={setObs} placeholder="Conferir os dados com a receita." linhas={3} />
      <T v="pequeno" cor="suave" style={{ marginBottom: 12 }}>Valores de exemplo da interface. Não são recomendações clínicas.</T>

      <Botao titulo="Continuar para programação" onPress={continuar} />
    </Pagina>
  );
}

// ---------- Cadastro: etapa 2 ----------

type Modo = Agendamento['tipo'];

export function TelaProgramar({ medId, rascunho }: { medId?: string; rascunho: RascunhoRemedio }) {
  const { estado, salvarMedicamento } = useApp();
  const nav = useNav();
  const { c, escala } = useTema();
  const existente = estado.medicamentos.find((m) => m.id === medId);
  const ag = existente?.agendamento;

  const [modo, setModo] = useState<Modo>(ag?.tipo ?? 'fixo');
  const [horarios, setHorarios] = useState<string[]>(ag?.horarios?.length ? ag.horarios : ['08:00']);
  const [intervalo, setIntervalo] = useState(String(ag?.intervalo_horas ?? 8));
  const [dias, setDias] = useState<number[]>(ag?.dias_semana ?? []);
  const [inicio, setInicio] = useState(chaveParaBR(existente?.periodo_inicio) || chaveParaBR(chaveData(new Date())));
  const [continuo, setContinuo] = useState(!existente?.periodo_fim);
  const [fim, setFim] = useState(chaveParaBR(existente?.periodo_fim));
  const [erro, setErro] = useState('');

  const mudarHorario = (i: number, texto: string) => {
    setHorarios(horarios.map((h, j) => (j === i ? mascaraHora(texto) : h)));
    setErro('');
  };

  const salvar = () => {
    const chaveInicio = brParaChave(inicio);
    if (!chaveInicio) return setErro('Digite a data de início no formato dd/mm/aaaa.');
    let chaveFim: string | null = null;
    if (!continuo) {
      chaveFim = brParaChave(fim);
      if (!chaveFim) return setErro('Digite a data de término no formato dd/mm/aaaa.');
      if (chaveFim < chaveInicio) return setErro('O término deve ser depois do início.');
    }

    const lista = modo === 'intervalo' ? horarios.slice(0, 1) : horarios;
    if (lista.length === 0 || lista.some((h) => !horaValida(h))) {
      return setErro('Digite os horários no formato 08:00.');
    }
    const unicos = Array.from(new Set(lista)).sort();

    let agendamento: Agendamento;
    if (modo === 'intervalo') {
      const n = Number(intervalo);
      if (!Number.isInteger(n) || n < 1 || n > 24) return setErro('O intervalo deve ser de 1 a 24 horas.');
      agendamento = { tipo: 'intervalo', intervalo_horas: n, horarios: unicos };
    } else if (modo === 'dias_semana') {
      if (dias.length === 0) return setErro('Escolha pelo menos um dia da semana.');
      agendamento = { tipo: 'dias_semana', horarios: unicos, dias_semana: [...dias].sort() };
    } else {
      agendamento = { tipo: 'fixo', horarios: unicos };
    }

    salvarMedicamento({
      id: existente?.id ?? novoId('m'),
      nome: rascunho.nome,
      dosagem: rascunho.dosagem || null,
      forma_uso: rascunho.forma_uso || null,
      observacoes: rascunho.observacoes || null,
      foto_url: rascunho.foto_url ?? null,
      agendamento,
      periodo_inicio: chaveInicio,
      periodo_fim: chaveFim,
      ativo: true,
      criado_em: existente?.criado_em ?? new Date().toISOString(),
    });
    avisar('Pronto', estado.prefs.lembretes
      ? `${rascunho.nome} salvo. Os lembretes foram agendados.`
      : `${rascunho.nome} salvo. Os lembretes estão desligados em Perfil.`);
    nav.raiz({ nome: 'remedios' });
  };

  const editorHorarios = (permitirVarios: boolean) => (
    <View>
      <T v="rotulo" style={{ marginBottom: 6 }}>{permitirVarios ? 'Horários' : 'Primeiro horário'}</T>
      {(permitirVarios ? horarios : horarios.slice(0, 1)).map((h, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <TextInput
            accessibilityLabel={`Horário ${i + 1}`}
            value={h}
            onChangeText={(t) => mudarHorario(i, t)}
            placeholder="08:00"
            placeholderTextColor={c.suave}
            keyboardType="numeric"
            maxLength={5}
            style={{ flex: 1, backgroundColor: c.campo, borderRadius: 10, borderWidth: 1, borderColor: c.borda, color: c.texto, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 * escala }}
          />
          {permitirVarios && horarios.length > 1 && (
            <Botao titulo="Remover" v="link" pequeno onPress={() => setHorarios(horarios.filter((_, j) => j !== i))} />
          )}
        </View>
      ))}
      {permitirVarios && (
        <Botao titulo="+ Adicionar outro horário" v="suave" pequeno onPress={() => setHorarios([...horarios, ''])} />
      )}
    </View>
  );

  return (
    <Pagina>
      <Voltar texto="Dados do remédio" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 4 }}>Programar remédio</T>
      <T cor="suave" style={{ marginBottom: 16 }}>
        {nomeCompleto({ id: '', nome: rascunho.nome, dosagem: rascunho.dosagem })} • Etapa 2 de 2. Escolha apenas um modo.
      </T>

      <Opcao texto="Horário fixo" marcada={modo === 'fixo'} onPress={() => setModo('fixo')}>
        {editorHorarios(true)}
        <T v="pequeno" cor="suave">Todos os dias, na hora marcada.</T>
      </Opcao>

      <Opcao texto="Intervalo" marcada={modo === 'intervalo'} onPress={() => setModo('intervalo')}>
        <Campo rotulo="A cada quantas horas?" valor={intervalo} onChange={(t) => setIntervalo(t.replace(/\D/g, '').slice(0, 2))} teclado="numeric" ajuda="Exemplo: 8 → a cada 8 horas." />
        {editorHorarios(false)}
      </Opcao>

      <Opcao texto="Dias específicos" marcada={modo === 'dias_semana'} onPress={() => setModo('dias_semana')}>
        <T v="rotulo" style={{ marginBottom: 6 }}>Dias da semana</T>
        <LinhaPilulas>
          {DIAS_CURTOS.map((d, i) => (
            <Pilula key={d} texto={d} marcada={dias.includes(i)} onPress={() => setDias(dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i])} />
          ))}
        </LinhaPilulas>
        {editorHorarios(true)}
      </Opcao>

      <Cartao>
        <T v="rotulo" style={{ marginBottom: 8 }}>Período de uso</T>
        <Campo rotulo="Data de início" valor={inicio} onChange={(t) => { setInicio(mascaraData(t)); setErro(''); }} placeholder="dd/mm/aaaa" teclado="numeric" />
        <Opcao texto="Uso contínuo" marcada={continuo} onPress={() => setContinuo(true)} />
        <Opcao texto="Com término" marcada={!continuo} onPress={() => setContinuo(false)}>
          <Campo rotulo="Data de término" valor={fim} onChange={(t) => { setFim(mascaraData(t)); setErro(''); }} placeholder="dd/mm/aaaa" teclado="numeric" ajuda="Ao fim do período, os lembretes são encerrados e o remédio vai para o histórico." />
        </Opcao>
      </Cartao>

      {!!erro && <T v="pequeno" cor="perigo" negrito style={{ marginBottom: 10 }}>{erro}</T>}
      <Botao titulo={existente ? 'Salvar alterações' : 'Salvar remédio'} onPress={salvar} />
    </Pagina>
  );
}

// ---------- Detalhes ----------

export function TelaDetalhes({ id }: { id: string }) {
  const { estado, excluirMedicamento } = useApp();
  const nav = useNav();
  const m = estado.medicamentos.find((x) => x.id === id);
  const [excluindo, setExcluindo] = useState(false);

  if (!m) {
    return (
      <Pagina>
        <Voltar texto="Remédios" onPress={() => nav.raiz({ nome: 'remedios' })} />
        <T>Remédio não encontrado.</T>
      </Pagina>
    );
  }

  const excluir = () => {
    excluirMedicamento(m.id);
    nav.raiz({ nome: 'remedios' });
  };

  const ag = m.agendamento;
  const modo = ag?.tipo === 'intervalo' ? 'Intervalo' : ag?.tipo === 'dias_semana' ? 'Dias específicos' : 'Horário fixo';

  return (
    <Pagina>
      <Voltar texto="Remédios" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 12 }}>Detalhes do remédio</T>
      <Cartao>
        <T v="subtitulo" style={{ marginBottom: 8 }}>{nomeCompleto(m)}</T>
        {!!m.dosagem && <T v="pequeno">Dosagem: {m.dosagem}</T>}
        {!!m.forma_uso && <T v="pequeno">Forma de uso: {m.forma_uso}</T>}
        <T v="pequeno">{modo}: {resumoHorarios(m)}</T>
        <T v="pequeno">Dias: {resumoDias(m).toLowerCase()}</T>
        <T v="pequeno">
          Início: {chaveParaBR(m.periodo_inicio)} • {m.periodo_fim ? `Término: ${chaveParaBR(m.periodo_fim)}` : 'Uso contínuo'}
        </T>
        {!!m.observacoes && <T v="pequeno" style={{ marginTop: 6 }}>Observações: {m.observacoes}</T>}
      </Cartao>
      <FotoEmbalagem uri={m.foto_url} />
      <Botao titulo="Editar" onPress={() => nav.ir({ nome: 'dadosRemedio', id: m.id })} />
      <Botao titulo="Orientações de uso" v="suave" onPress={() => nav.ir({ nome: 'orientacoes', medId: m.id })} />
      <Botao titulo="Excluir" v="suave" onPress={() => setExcluindo(true)} />
      {excluindo && (
        <ConfirmarExclusao
          titulo="Ao excluir • confirmação"
          texto={`Excluir ${m.nome}? Remover o medicamento encerra seus lembretes.`}
          rotuloConfirmar="Excluir medicamento"
          onConfirmar={excluir}
          onCancelar={() => setExcluindo(false)}
        />
      )}
    </Pagina>
  );
}

// ---------- Hora do remédio ----------

export function TelaHoraRemedio({ medId, horario }: { medId: string; horario: string }) {
  const { estado, registrarDose } = useApp();
  const nav = useNav();
  const med = estado.medicamentos.find((m) => m.id === medId);
  const previsto = new Date(horario);
  const registro = estado.registros.find(
    (r) => r.medicamento_id === medId && new Date(r.horario_previsto).getTime() === previsto.getTime()
  );
  const [adiando, setAdiando] = useState(false);
  const [novo, setNovo] = useState(formatarHora(minutosDepois(new Date(), MINUTOS_ADIAR)));
  const [erro, setErro] = useState('');

  if (!med) {
    return (
      <Pagina>
        <Voltar texto="Início" onPress={() => nav.raiz({ nome: 'inicio' })} />
        <T>Este remédio não está mais cadastrado.</T>
      </Pagina>
    );
  }

  const registrar = (status: 'tomada' | 'nao_tomada') => {
    registrarDose(med.id, previsto.toISOString(), status);
    nav.raiz({ nome: 'inicio' });
  };

  const confirmarAdiamento = () => {
    if (!horaValida(novo)) return setErro('Digite o horário no formato 12:30.');
    const [h, m] = novo.split(':').map(Number);
    const alvo = new Date();
    alvo.setHours(h, m, 0, 0);
    if (alvo <= new Date()) return setErro('Escolha um horário depois de agora.');
    registrarDose(med.id, previsto.toISOString(), 'adiada', alvo.toISOString());
    avisar('Dose adiada', `Vamos lembrar de novo às ${novo}.`);
    nav.raiz({ nome: 'inicio' });
  };

  return (
    <Pagina>
      <Voltar texto="Início" onPress={() => nav.raiz({ nome: 'inicio' })} />
      <T v="titulo" style={{ marginBottom: 12 }}>Hora do remédio</T>

      <Cartao>
        <T v="subtitulo">{nomeCompleto(med)}</T>
        <T v="pequeno" style={{ marginVertical: 2 }}>
          {med.forma_uso ? `${med.forma_uso} • ` : ''}{formatarHora(previsto)}
        </T>
        {registro ? (
          <T v="pequeno" cor="primaria" negrito>
            Registro: {textoStatus(registro.status)}
            {registro.status === 'adiada' && registro.novo_horario ? ` para ${formatarHora(new Date(registro.novo_horario))}` : ''}
          </T>
        ) : (
          <T v="pequeno" cor="suave">Confirme se você tomou este remédio.</T>
        )}
      </Cartao>

      <Botao titulo="Tomei" onPress={() => registrar('tomada')} />
      <Botao titulo="Não tomei" v="suave" onPress={() => registrar('nao_tomada')} />
      <Botao titulo="Adiar" v="suave" onPress={() => setAdiando(!adiando)} />

      {adiando && (
        <Cartao>
          <T v="rotulo" style={{ marginBottom: 6 }}>Ao escolher Adiar</T>
          <Campo rotulo="Novo horário" valor={novo} onChange={(t) => { setNovo(mascaraHora(t)); setErro(''); }} teclado="numeric" maxLength={5} erro={erro} />
          <Botao titulo="Confirmar adiamento" onPress={confirmarAdiamento} />
        </Cartao>
      )}

      <Botao titulo="Configurar som e vibração" v="link" onPress={() => nav.ir({ nome: 'acessibilidade' })} />
    </Pagina>
  );
}

// ---------- Orientações de uso ----------

export function TelaOrientacoes({ medId }: { medId: string }) {
  const { estado, concluirOrientacao, excluirOrientacao } = useApp();
  const nav = useNav();
  const med = estado.medicamentos.find((m) => m.id === medId);
  const lista = estado.orientacoes.filter((o) => o.medicamento_id === medId);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  return (
    <Pagina>
      <Voltar texto="Detalhes do remédio" onPress={() => nav.ir({ nome: 'detalhes', id: medId })} />
      <T v="titulo" style={{ marginBottom: 4 }}>Orientações de uso</T>
      <T v="pequeno" cor="suave" style={{ marginBottom: 12 }}>Associadas a {med ? nomeCompleto(med) : 'remédio removido'}</T>

      <Botao titulo="Adicionar orientação" onPress={() => nav.ir({ nome: 'dadosOrientacao', medId })} />
      {lista.length === 0 && <Cartao><T v="pequeno" cor="suave">Nenhuma orientação cadastrada.</T></Cartao>}

      {lista.map((o) => {
        const vencida = orientacaoVencida(o);
        return (
          <Cartao key={o.id}>
            <T negrito style={{ marginBottom: 4 }}>{o.texto.length > 40 ? `${o.texto.slice(0, 40)}...` : o.texto}</T>
            <T v="pequeno">{o.texto}</T>
            {!!o.validade && <T v="pequeno" style={{ marginTop: 4 }}>Validade: {chaveParaBR(o.validade)}</T>}
            <T v="pequeno" cor={o.concluida ? 'sucesso' : vencida ? 'alerta' : 'primaria'} negrito>
              {o.concluida ? 'Concluída' : vencida ? 'Revisão pendente · Continua ativa' : 'Em vigor'}
            </T>
            {vencida && (
              <T v="pequeno" cor="suave" style={{ marginVertical: 4 }}>
                A validade terminou. Revise as datas ou marque como concluída. Você recebe um lembrete diário às 9h.
              </T>
            )}
            <View style={{ marginTop: 8 }}>
              <Botao titulo="Visualizar" v="link" pequeno onPress={() => nav.ir({ nome: 'dadosOrientacao', medId, id: o.id, ver: true })} />
              <Botao titulo="Editar" v="suave" pequeno onPress={() => nav.ir({ nome: 'dadosOrientacao', medId, id: o.id })} />
              {!o.concluida && <Botao titulo="Marcar concluída" pequeno onPress={() => concluirOrientacao(o.id)} />}
              <Botao titulo="Excluir" v="link" pequeno onPress={() => setExcluindo(o.id)} />
            </View>
            {excluindo === o.id && (
              <ConfirmarExclusao
                titulo="Ao excluir • confirmação"
                texto="Excluir esta orientação? Ela deixará de ficar ativa e o lembrete será cancelado."
                rotuloConfirmar="Confirmar exclusão"
                onConfirmar={() => { excluirOrientacao(o.id); setExcluindo(null); }}
                onCancelar={() => setExcluindo(null)}
              />
            )}
          </Cartao>
        );
      })}
    </Pagina>
  );
}

export function TelaDadosOrientacao({ medId, id, ver }: { medId: string; id?: string; ver?: boolean }) {
  const { estado, salvarOrientacao, concluirOrientacao, excluirOrientacao } = useApp();
  const nav = useNav();
  const med = estado.medicamentos.find((m) => m.id === medId);
  const existente = estado.orientacoes.find((o) => o.id === id);

  const [somenteVer, setSomenteVer] = useState(!!ver && !!existente);
  const [excluindo, setExcluindo] = useState(false);
  const [texto, setTexto] = useState(existente?.texto ?? '');
  const [inicio, setInicio] = useState(chaveParaBR(existente?.inicio) || chaveParaBR(chaveData(new Date())));
  const [fim, setFim] = useState(chaveParaBR(existente?.validade));
  const [erro, setErro] = useState('');

  const salvar = (): OrientacaoApp | null => {
    if (texto.trim().length < 3) { setErro('Digite o texto da orientação.'); return null; }
    const chaveInicio = brParaChave(inicio);
    const chaveFim = brParaChave(fim);
    if (!chaveInicio) { setErro('Digite o início da validade (dd/mm/aaaa).'); return null; }
    if (!chaveFim) { setErro('Digite o fim da validade (dd/mm/aaaa).'); return null; }
    if (chaveFim < chaveInicio) { setErro('O fim da validade deve ser depois do início.'); return null; }
    const o: OrientacaoApp = {
      id: existente?.id ?? novoId('o'),
      medicamento_id: medId,
      texto: texto.trim(),
      inicio: chaveInicio,
      validade: chaveFim,
      concluida: existente?.concluida ?? false,
    };
    salvarOrientacao(o);
    return o;
  };

  return (
    <Pagina>
      <Voltar texto="Orientações de uso" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 4 }}>Dados da orientação</T>
      <T cor="suave" style={{ marginBottom: 16 }}>
        {somenteVer ? 'Visualizando a orientação.' : 'Preencha o formulário para adicionar ou editar.'}
      </T>

      <Campo rotulo="Medicamento associado" valor={med ? nomeCompleto(med) : ''} somenteLeitura />
      <Campo rotulo="Texto da orientação" valor={texto} onChange={(t) => { setTexto(t); setErro(''); }} placeholder="Conferir as instruções da receita com o farmacêutico." linhas={3} somenteLeitura={somenteVer} />
      <Campo rotulo="Início da validade" valor={inicio} onChange={(t) => setInicio(mascaraData(t))} placeholder="dd/mm/aaaa" teclado="numeric" somenteLeitura={somenteVer} />
      <Campo rotulo="Fim da validade" valor={fim} onChange={(t) => { setFim(mascaraData(t)); setErro(''); }} placeholder="dd/mm/aaaa" teclado="numeric" erro={erro} somenteLeitura={somenteVer} />

      {somenteVer ? (
        <Botao titulo="Editar" onPress={() => setSomenteVer(false)} />
      ) : (
        <Botao titulo="Salvar orientação / alterações" onPress={() => salvar() && nav.voltar()} />
      )}
      {existente && !existente.concluida && (
        <Botao titulo="Concluir orientação" v="suave" onPress={() => { concluirOrientacao(existente.id); nav.voltar(); }} />
      )}
      {existente && <Botao titulo="Excluir orientação" v="suave" onPress={() => setExcluindo(true)} />}
      {existente && excluindo && (
        <ConfirmarExclusao
          titulo="Ao excluir • confirmação"
          texto="Excluir esta orientação? Ela deixará de ficar ativa e o lembrete será cancelado."
          rotuloConfirmar="Confirmar exclusão"
          onConfirmar={() => { excluirOrientacao(existente.id); nav.voltar(); }}
          onCancelar={() => setExcluindo(false)}
        />
      )}
    </Pagina>
  );
}
