// Formatos de placa e telefone usados em todo o sistema. Arquivo "puro" (sem
// banco nem Next.js), testado em formatos.test.ts.
//
// Os mesmos formatos estão nos CHECKs do banco (supabase/migrations/): se
// mudar aqui, mude lá. "normalizar" limpa o que a pessoa digitou; "validar"
// confere o resultado já limpo, que é o que vai para o banco.

// Placa maiúscula sem hífen: antiga ABC1234 ou Mercosul ABC1D23.
const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

// " abc-1d23 " -> "ABC1D23". Tira só espaços e hífens; o resto fica e a
// validação recusa.
export function normalizarPlaca(digitada: string): string {
  return digitada.replace(/[\s-]/g, "").toUpperCase();
}

export const ERRO_PLACA = "Placa inválida: use ABC1234 ou ABC1D23.";

export function validarPlaca(placa: string): boolean {
  return PLACA.test(placa);
}

// Placa como está escrita na chapa: "ABC1234" -> "ABC-1234" (antiga, com
// hífen); Mercosul "ABC1D23" fica igual. Só para mostrar: no banco não tem hífen.
export function formatarPlaca(placa: string): string {
  const antiga = validarPlaca(placa) && /[0-9]/.test(placa[4]);
  return antiga ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}

// Telefone só com dígitos: DDD + número (10 fixo, 11 celular).
const TELEFONE = /^[0-9]{10,11}$/;

// "(47) 99999-0000" -> "47999990000". Tira só a máscara (espaço ( ) - . +);
// letras ficam e a validação recusa. Tira o 55 do Brasil quando vem junto
// (ex.: número copiado do WhatsApp), mas só se sobrar dígito demais: o DDD 55
// (RS) continua valendo.
export function normalizarTelefone(digitado: string): string {
  const limpo = digitado.replace(/[\s().+-]/g, "");
  if (limpo.length > 11 && limpo.startsWith("55")) return limpo.slice(2);
  return limpo;
}

export function validarTelefone(telefone: string): boolean {
  return TELEFONE.test(telefone);
}

// "47999990000" -> "(47) 99999-0000", para mostrar na tela.
export function formatarTelefone(telefone: string): string {
  const partes = telefone.match(/^([0-9]{2})([0-9]{4,5})([0-9]{4})$/);
  return partes ? `(${partes[1]}) ${partes[2]}-${partes[3]}` : telefone;
}

// Fuso da oficina: datas sempre mostradas e contadas nele (o servidor pode estar em UTC).
export const FUSO = "America/Sao_Paulo";

// Data e hora no fuso da oficina.
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "2026-10-27T15:30:00Z" -> "27/10/2026 12:30".
export function formatarDataHora(iso: string): string {
  const partes = Object.fromEntries(dataHora.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}
