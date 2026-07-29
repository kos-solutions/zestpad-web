/** Coduri fara caractere ambigue (0/O, 1/I/L) — se dicteaza cu voce tare in clasa. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Cod de legatura parinte-copil, mai lung ca sa nu poata fi ghicit. */
export function generateLinkCode(): string {
  return generateCode(8);
}
