import { createHmac, timingSafeEqual } from "node:crypto";
import type { Locale } from "../i18n";

export type CancelKind = "visitor" | "photographer";

export type CancelTokenPayload = { id: string; kind: CancelKind };

const kinds: readonly CancelKind[] = ["visitor", "photographer"];

function signature(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signCancelToken(payload: CancelTokenPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify({ id: payload.id, kind: payload.kind })).toString("base64url");
  return `${data}.${signature(data, secret)}`;
}

export function verifyCancelToken(token: string, secret: string): CancelTokenPayload | null {
  if (typeof token !== "string") return null;
  const [data, mac, ...rest] = token.split(".");
  if (!data || !mac || rest.length > 0) return null;
  const expected = Buffer.from(signature(data, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    const { id, kind } = payload as Record<string, unknown>;
    if (typeof id !== "string" || !id || !kinds.includes(kind as CancelKind)) return null;
    return { id, kind: kind as CancelKind };
  } catch {
    return null;
  }
}

export function cancelUrl(
  baseUrl: string,
  locale: Locale,
  payload: CancelTokenPayload,
  secret: string,
): string {
  const token = encodeURIComponent(signCancelToken(payload, secret));
  return `${baseUrl.replace(/\/+$/, "")}/${locale}/booking/cancel?token=${token}`;
}
