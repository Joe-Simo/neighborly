/**
 * A name as it is matched and looked up: its accents set aside, in small letters, its words one space apart.
 * "José  García" and "jose garcia" are the same key, so a search typed either way finds the record.
 */
export const nameKey = (name: string) =>
  name.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
