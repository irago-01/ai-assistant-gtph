import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const algorithm = "aes-256-gcm";

function deriveKey(secret: string) {
  return scryptSync(secret, "work-os-salt", 32);
}

export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(16);
  const key = deriveKey(secret);
  const cipher = createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(payload: string, secret: string): string {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted token format");
  }

  const key = deriveKey(secret);
  const decipher = createDecipheriv(algorithm, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
