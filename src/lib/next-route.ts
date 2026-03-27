import type { NextRequest, NextResponse } from "next/server";

import {
  ensureSessionFromCookieHeader,
  getSessionFromCookieHeader,
  type SessionCookieDescriptor,
} from "./session";

export function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getExistingSession(request: NextRequest) {
  return getSessionFromCookieHeader(request.headers.get("cookie"));
}

export function ensureRequestSession(request: NextRequest) {
  return ensureSessionFromCookieHeader(
    request.headers.get("cookie"),
    isSecureRequest(request),
  );
}

export function applySessionCookie(
  response: NextResponse,
  cookie: SessionCookieDescriptor,
): void {
  response.cookies.set(cookie);
}

function isSecureRequest(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}
