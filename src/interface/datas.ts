// Funções de data em português, sempre no horário local do aparelho.

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Ordem do contrato: 0 = segunda ... 6 = domingo
export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MS_DIA = 24 * 60 * 60 * 1000;

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function somarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

export function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Date -> "YYYY-MM-DD"
export function chaveData(d: Date): string {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

// "YYYY-MM-DD" -> Date local à meia-noite (null se inválida)
export function dataDeChave(chave?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chave || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

// "12 de outubro"
export function dataLonga(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// "12 de outubro de 2026"
export function dataCompleta(d: Date): string {
  return `${dataLonga(d)} de ${d.getFullYear()}`;
}

// "outubro de 2026" com a primeira letra maiúscula
export function mesAno(d: Date): string {
  const nome = MESES[d.getMonth()];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${d.getFullYear()}`;
}

// "YYYY-MM-DD" -> "dd/mm/aaaa"
export function chaveParaBR(chave?: string | null): string {
  const d = dataDeChave(chave);
  return d ? `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}

// "dd/mm/aaaa" -> "YYYY-MM-DD" (null se inválida)
export function brParaChave(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const d = dataDeChave(`${m[3]}-${m[2]}-${m[1]}`);
  return d ? chaveData(d) : null;
}

// Máscara enquanto digita: 05031954 -> 05/03/1954
export function mascaraData(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

// Máscara de horário: 0830 -> 08:30
export function mascaraHora(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

export function horaValida(texto: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(texto);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

// Máscara de celular: 11999991234 -> (11) 99999-1234
export function mascaraCelular(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

export function calcularIdade(nascimento?: string | null, hoje: Date = new Date()): number | null {
  const nasc = dataDeChave(nascimento);
  if (!nasc) return null;
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const fezAniversario =
    hoje.getMonth() > nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
  if (!fezAniversario) idade--;
  return idade >= 0 ? idade : null;
}

// Os 7 dias da semana do dia dado (segunda a domingo)
export function semanaDe(d: Date): Date[] {
  const inicio = somarDias(inicioDoDia(d), -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

// Semanas do mês (segunda a domingo); células fora do mês vêm como null
export function gradeDoMes(ano: number, mes: number): (Date | null)[][] {
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const vazios = (primeiro.getDay() + 6) % 7;
  const celulas: (Date | null)[] = [];
  for (let i = 0; i < vazios; i++) celulas.push(null);
  for (let dia = 1; dia <= ultimo; dia++) celulas.push(new Date(ano, mes, dia));
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (Date | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export function saudacao(agora: Date = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export function minutosDepois(d: Date, minutos: number): Date {
  return new Date(d.getTime() + minutos * 60 * 1000);
}

export { MS_DIA };
