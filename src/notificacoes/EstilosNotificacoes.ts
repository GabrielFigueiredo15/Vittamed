import { StyleSheet } from 'react-native';

// Fontes e botões maiores que o padrão: público idoso (RNF05)
export default StyleSheet.create({

  container: { flex: 1, backgroundColor: '#f5f5f5' },

  containerCarregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },

  conteudo: { padding: 25, paddingTop: 60 },

  titulo: { fontSize: 32, fontWeight: 'bold', color: '#000000', marginBottom: 20 },

  caixa: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dddddd'
  },

  paragrafo: { fontSize: 20, color: '#222222', marginBottom: 10, lineHeight: 28 },

  aviso: { fontSize: 18, color: '#b00020', fontWeight: 'bold', marginTop: 5 },

  linhaCheckbox: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },

  checkbox: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },

  checkboxMarcado: { backgroundColor: '#000000' },

  checkboxSimbolo: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },

  textoCheckbox: { flex: 1, fontSize: 20, color: '#000000' },

  botao: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 15
  },

  botaoDesabilitado: { opacity: 0.5 },

  textoBotao: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },

  botaoSecundario: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000' },

  textoBotaoSecundario: { color: '#000000' }
});
