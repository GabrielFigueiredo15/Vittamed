import { StyleSheet } from 'react-native';

// Fontes e botões maiores que o padrão: público idoso (RNF05)
export default StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },

  containerCarregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },

  conteudo: {
    padding: 25,
    paddingTop: 60,
    paddingBottom: 40
  },

  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#222222'
  },

  caixa: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 25
  },

  paragrafo: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333333'
  },

  aviso: {
    fontSize: 18,
    lineHeight: 26,
    color: '#b00020',
    marginTop: 10
  },

  linhaCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    minHeight: 48
  },

  checkbox: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#555555',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#ffffff'
  },

  checkboxMarcado: {
    backgroundColor: '#000000',
    borderColor: '#000000'
  },

  checkboxSimbolo: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold'
  },

  textoCheckbox: {
    flex: 1,
    fontSize: 19,
    color: '#222222'
  },

  botao: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    marginBottom: 15
  },

  botaoSecundario: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000'
  },

  botaoDesabilitado: {
    backgroundColor: '#cccccc',
    borderColor: '#cccccc'
  },

  textoBotao: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: 'bold'
  },

  textoBotaoSecundario: {
    color: '#000000'
  }

});
