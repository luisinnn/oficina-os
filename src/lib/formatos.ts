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

export function validarPlaca(placa: string): boolean {
  return PLACA.test(placa);
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
