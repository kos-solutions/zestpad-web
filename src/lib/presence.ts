/**
 * Prezenta la lectie — deliberat efemera.
 *
 * Ce este: profesorul vede cine e cu el chiar acum, ca sa predea altfel —
 * sa explice cu voce tare in loc sa arate cu degetul, sa intrebe "Andrei,
 * ma auzi?".
 *
 * Ce NU este si nu trebuie sa devina: un catalog de prezenta. Semnalul e
 * nesigur in ambele sensuri — ecranul blocat trei secunde inseamna "absent",
 * iar o tableta lasata deschisa pe masa inseamna "prezent". Un catalog care
 * greseste in ambele directii e mai rau decat niciunul, pentru ca cineva il
 * va crede si va nedreptati un copil.
 *
 * De aceea: fara istoric, fara jurnal, fara export.
 */

/** Cat timp dupa ultimul semn de viata mai consideram un elev conectat. */
export const PRESENCE_WINDOW_MS = 12_000;

/** Randurile mai vechi de atat se sterg; nu le pastram "pentru orice eventualitate". */
export const PRESENCE_PRUNE_MS = 60_000;

export function isPresent(lastSeenAt: Date, now = Date.now()): boolean {
  return now - lastSeenAt.getTime() < PRESENCE_WINDOW_MS;
}
