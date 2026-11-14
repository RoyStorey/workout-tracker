import crypto from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function randomCode(len = 10): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 40)
      .replace(/^-+|-+$/g, "") || "x"
  );
}
