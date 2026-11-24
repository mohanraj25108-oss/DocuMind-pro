import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const SECRET_FILE = path.join(DATA_DIR, ".app-secret");

function getAppSecret(): Buffer {
  const envSecret = process.env.DOCUMIND_SECRET;
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash("sha256").update(envSecret).digest();
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (existing.length >= 32) {
      return crypto.createHash("sha256").update(existing).digest();
    }
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, generated, { encoding: "utf8", mode: 0o600 });
  return crypto.createHash("sha256").update(generated).digest();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, "hex");
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signValue(raw: string): string {
  const secret = getAppSecret();
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}

export function verifySignedValue(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const raw = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = signValue(raw).slice(raw.length + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return raw;
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getAppSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  const parts = payload.split(".");
  if (parts.length !== 3) return "";
  try {
    const key = getAppSecret();
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const encrypted = Buffer.from(parts[2], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
