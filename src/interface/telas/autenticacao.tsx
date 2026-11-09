// Login, criação de conta, perfil, recuperação de senha e tela sem conexão.
// A conta fica só neste aparelho (protótipo sem servidor).

import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useApp } from '../estado';
import { escolherFoto } from '../foto';
import {
  Botao,
  Cartao,
  Caixa,
  Campo,
  Iniciais,
  LinhaPilulas,
  Pagina,
  Pilula,
  T,
  Voltar,
  avisar,
  useNav,
  useTema,
} from '../ui';
import {
  brParaChave,
  calcularIdade,
  chaveParaBR,
  mascaraCelular,
  mascaraData,
} from '../datas';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const estaOffline = (): boolean =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;

export function TelaLogin() {
  const { entrar, estado } = useApp();
  const nav = useNav();
  const { c } = useTema();
  const [email, setEmail] = useState(estado.usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');

  const aoEntrar = () => {
    if (!EMAIL_VALIDO.test(email.trim())) return setErro('Digite um e-mail válido.');
    if (!senha) return setErro('Digite sua senha.');
    const resultado = entrar(email, senha, lembrar);
    if (resultado === 'sem_conta') setErro('Não encontramos uma conta com este e-mail. Toque em "Criar conta".');
    else if (resultado === 'senha_errada') setErro('Senha incorreta. Tente de novo.');
  };

  return (
    <Pagina>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.suaveFundo, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <T cor="primaria" negrito>💊</T>
        </View>
        <T v="rotulo" negrito>Vittamed</T>
      </View>
      <T v="titulo" style={{ marginBottom: 4 }}>Bem-vindo de volta!</T>
      <T cor="suave" style={{ marginBottom: 20 }}>Entre na sua conta para acompanhar seus remédios.</T>

      <Campo rotulo="E-mail" valor={email} onChange={(t) => { setEmail(t); setErro(''); }} placeholder="seu.email@email.com" teclado="email-address" />
      <Campo rotulo="Senha" valor={senha} onChange={(t) => { setSenha(t); setErro(''); }} senha placeholder="Sua senha" />
      {!!erro && <T v="pequeno" cor="perigo" style={{ marginBottom: 12 }}>{erro}</T>}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Caixa marcada={lembrar} onPress={() => setLembrar(!lembrar)}>
            <T v="pequeno">Lembrar de mim</T>
          </Caixa>
        </View>
        <Pressable onPress={() => nav.ir({ nome: 'recuperarSenha' })} accessibilityRole="link" style={{ paddingBottom: 14 }}>
          <T v="pequeno" cor="primaria" negrito>Esqueci minha senha</T>
        </Pressable>
      </View>

      <Botao titulo="Entrar" onPress={aoEntrar} />
      <T v="pequeno" cor="suave" centro style={{ marginVertical: 6 }}>Ainda não tem uma conta?</T>
      <Botao titulo="Criar conta" v="suave" onPress={() => nav.ir({ nome: 'criarConta' })} />
    </Pagina>
  );
}

export function TelaCriarConta() {
  const { contaExiste } = useApp();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const continuar = () => {
    const e: Record<string, string> = {};
    if (!EMAIL_VALIDO.test(email.trim())) e.email = 'Digite um e-mail válido.';
    else if (contaExiste(email)) e.email = 'Já existe uma conta com este e-mail neste aparelho.';
    if (senha.length < 8) e.senha = 'Use pelo menos 8 caracteres.';
    if (confirmar !== senha) e.confirmar = 'As senhas não são iguais.';
    if (!aceito) e.termos = 'Aceite os termos para continuar.';
    setErros(e);
    if (Object.keys(e).length === 0) nav.ir({ nome: 'completarPerfil', email: email.trim(), senha });
  };

  return (
    <Pagina>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Voltar texto="Entrar" onPress={nav.voltar} />
        <T v="pequeno" cor="primaria" negrito style={{ paddingVertical: 8 }}>Etapa 1 de 2</T>
      </View>
      <T v="titulo" style={{ marginBottom: 4 }}>Criar conta</T>
      <T cor="suave" style={{ marginBottom: 20 }}>Comece a cuidar da sua rotina de remédios com tranquilidade.</T>

      <Campo rotulo="E-mail" valor={email} onChange={setEmail} placeholder="seu.email@email.com" teclado="email-address" erro={erros.email} />
      <Campo rotulo="Criar senha" valor={senha} onChange={setSenha} senha ajuda="Use pelo menos 8 caracteres." erro={erros.senha} />
      <Campo rotulo="Confirmar senha" valor={confirmar} onChange={setConfirmar} senha erro={erros.confirmar} />

      <Caixa marcada={aceito} onPress={() => setAceito(!aceito)}>
        <T v="pequeno">Li e aceito os <T v="pequeno" cor="primaria" negrito>Termos de uso</T> e a <T v="pequeno" cor="primaria" negrito>Política de privacidade</T>.</T>
      </Caixa>
      {!!erros.termos && <T v="pequeno" cor="perigo" style={{ marginBottom: 12 }}>{erros.termos}</T>}

      <Botao titulo="Criar conta" onPress={continuar} />
      <T v="pequeno" cor="suave" centro style={{ marginTop: 14 }}>Já tem uma conta?</T>
      <Botao titulo="Entrar" v="link" onPress={nav.voltar} />
    </Pagina>
  );
}

const GENEROS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];

export function TelaCompletarPerfil({ email, senha, editar }: { email?: string; senha?: string; editar?: boolean }) {
  const { estado, criarConta, atualizarUsuario } = useApp();
  const nav = useNav();
  const u = estado.usuario;
  const [nome, setNome] = useState(editar ? u?.nome ?? '' : '');
  const [celular, setCelular] = useState(editar ? u?.celular ?? '' : '');
  const [nascimento, setNascimento] = useState(editar ? chaveParaBR(u?.nascimento) : '');
  const [genero, setGenero] = useState(editar ? u?.genero ?? '' : '');
  const [foto, setFoto] = useState<string | null>(editar ? u?.foto ?? null : null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const chaveNasc = brParaChave(nascimento);
  const idade = chaveNasc ? calcularIdade(chaveNasc) : null;

  const trocarFoto = async () => {
    try {
      const resultado = await escolherFoto(true);
      if (resultado === 'negada') avisar('Sem permissão', 'Libere o acesso às fotos nas configurações para escolher uma imagem.');
      else if (resultado) setFoto(resultado.uri);
    } catch (erro) {
      console.log(erro);
      avisar('Erro', 'Não foi possível abrir a galeria.');
    }
  };

  const concluir = () => {
    const e: Record<string, string> = {};
    if (nome.trim().length < 2) e.nome = 'Digite seu nome completo.';
    if (celular.replace(/\D/g, '').length < 10) e.celular = 'Digite o celular com DDD.';
    if (!chaveNasc || idade === null) e.nascimento = 'Use o formato dd/mm/aaaa.';
    if (!genero) e.genero = 'Escolha uma opção.';
    setErros(e);
    if (Object.keys(e).length) return;

    const dados = { nome: nome.trim(), celular, nascimento: chaveNasc as string, genero, foto };
    if (editar) {
      atualizarUsuario(dados);
      avisar('Pronto', 'Seus dados foram atualizados.');
      nav.voltar();
    } else {
      criarConta({ email: email ?? '', senha: senha ?? '', ...dados });
    }
  };

  return (
    <Pagina>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Voltar texto={editar ? 'Perfil' : 'Voltar'} onPress={nav.voltar} />
        {!editar && <T v="pequeno" cor="primaria" negrito style={{ paddingVertical: 8 }}>Etapa 2 de 2</T>}
      </View>
      <T v="titulo" style={{ marginBottom: 4 }}>{editar ? 'Minha conta' : 'Completar perfil'}</T>
      <T cor="suave" style={{ marginBottom: 20 }}>
        {editar ? 'Atualize seus dados pessoais.' : 'Preencha seus dados para completar o perfil.'}
      </T>

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Iniciais nome={nome || '?'} tamanho={84} foto={foto} />
        <Botao titulo={foto ? 'Trocar foto' : 'Adicionar foto'} v="link" onPress={trocarFoto} />
      </View>

      <Campo rotulo="Nome completo" valor={nome} onChange={setNome} placeholder="João Silva" autoCapitalize="words" erro={erros.nome} />
      <Campo rotulo="Número de celular" valor={celular} onChange={(t) => setCelular(mascaraCelular(t))} placeholder="(11) 99999-1234" teclado="phone-pad" erro={erros.celular} />
      <Campo rotulo="Data de nascimento" valor={nascimento} onChange={(t) => setNascimento(mascaraData(t))} placeholder="dd/mm/aaaa" teclado="numeric" erro={erros.nascimento} />
      <Campo rotulo="Idade" valor={idade !== null ? `${idade} anos` : ''} somenteLeitura placeholder="Calculada pela data de nascimento" />

      <T v="rotulo" style={{ marginBottom: 8 }}>Gênero</T>
      <LinhaPilulas>
        {GENEROS.map((g) => (
          <Pilula key={g} texto={g} marcada={genero === g} onPress={() => setGenero(g)} />
        ))}
      </LinhaPilulas>
      {!!erros.genero && <T v="pequeno" cor="perigo">{erros.genero}</T>}

      <View style={{ height: 16 }} />
      <Botao titulo={editar ? 'Salvar alterações' : 'Concluir perfil'} onPress={concluir} />
    </Pagina>
  );
}

export function TelaRecuperarSenha() {
  const { contaExiste } = useApp();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = () => {
    if (!EMAIL_VALIDO.test(email.trim())) return setErro('Digite um e-mail válido.');
    if (estaOffline()) return nav.ir({ nome: 'semConexao' });
    setErro('');
    setEnviado(true);
  };

  return (
    <Pagina>
      <Voltar texto="Voltar ao login" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 4 }}>Recuperar senha</T>
      <T cor="suave" style={{ marginBottom: 20 }}>Informe o e-mail da conta compartilhada para receber um link de recuperação.</T>
      <Campo rotulo="E-mail da conta" valor={email} onChange={(t) => { setEmail(t); setEnviado(false); }} placeholder="seu.email@email.com" teclado="email-address" erro={erro} />
      <Botao titulo="Enviar link" onPress={enviar} />

      {enviado && (
        <Cartao>
          <T v="rotulo" style={{ marginBottom: 6 }}>Confirmação após o envio</T>
          <T v="pequeno">
            {contaExiste(email)
              ? 'Link enviado. Confira seu e-mail. A nova senha vale para todos que usam esta conta.'
              : 'Se existir uma conta com este e-mail, o link será enviado. Confira sua caixa de entrada.'}
          </T>
          <T v="pequeno" cor="suave" style={{ marginTop: 8 }}>
            Protótipo: este aplicativo ainda não tem servidor, então nenhum e-mail é enviado de verdade.
          </T>
        </Cartao>
      )}
      <Botao titulo="Voltar ao login" v="suave" onPress={nav.voltar} />
    </Pagina>
  );
}

export function TelaSemConexao() {
  const nav = useNav();
  const [ainda, setAinda] = useState(false);

  const tentar = () => {
    if (estaOffline()) setAinda(true);
    else nav.voltar();
  };

  return (
    <Pagina>
      <Voltar texto="Tela anterior" onPress={nav.voltar} />
      <T v="titulo" style={{ marginBottom: 16 }}>Sem conexão</T>
      <Cartao>
        <T v="rotulo" style={{ marginBottom: 6 }}>Não foi possível conectar</T>
        <T v="pequeno" style={{ marginBottom: 6 }}>O Vittamed precisa de internet para acessar suas funcionalidades.</T>
        <T v="pequeno">Verifique o Wi-Fi ou os dados móveis e tente novamente. Não há acesso offline.</T>
      </Cartao>
      <Botao titulo="Tentar novamente" onPress={tentar} />
      {ainda && <T v="pequeno" cor="perigo" style={{ marginBottom: 10 }}>Ainda sem conexão.</T>}
      <T v="pequeno" cor="suave">Ao reconectar, você poderá retornar à tela de origem.</T>
    </Pagina>
  );
}
