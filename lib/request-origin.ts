import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  return value.split(",")[0]?.trim() ?? null;
}

export function resolveRequestOrigin(request: NextRequest) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host) {
    const proto = request.nextUrl.protocol.replace(":", "") || "http";
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}
