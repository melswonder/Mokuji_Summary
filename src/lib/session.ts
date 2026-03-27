import { randomUUID } from "node:crypto";

import type { AppSession, SessionUser } from "./types";

export const SESSION_COOKIE = "oreilly_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const sessions = new Map<string, AppSession>();

export interface SessionCookieDescriptor {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  maxAge: number;
  path: "/";
  secure: boolean;
}

export function ensureSessionFromCookieHeader(
  cookieHeader?: string | null,
  secure = false,
): {
  session: AppSession;
  cookie: SessionCookieDescriptor;
} {
  const existingId = readCookie(cookieHeader, SESSION_COOKIE);
  const existing = existingId ? sessions.get(existingId) : undefined;
  if (existing) {
    return {
      session: existing,
      cookie: buildSessionCookie(existing.id, secure),
    };
  }

  const session: AppSession = {
    id: randomUUID(),
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return {
    session,
    cookie: buildSessionCookie(session.id, secure),
  };
}

export function getSessionFromCookieHeader(
  cookieHeader?: string | null,
): AppSession | undefined {
  const sessionId = readCookie(cookieHeader, SESSION_COOKIE);
  return sessionId ? sessions.get(sessionId) : undefined;
}

export function setOauthState(session: AppSession, state: string): void {
  session.oauthState = state;
}

export function clearOauthState(session: AppSession): void {
  delete session.oauthState;
}

export function setGoogleSession(
  session: AppSession,
  google: AppSession["google"],
): void {
  session.google = google;
}

export function clearGoogleSession(session: AppSession): void {
  delete session.google;
}

export function serializeSession(session?: AppSession): {
  id?: string;
  user?: SessionUser;
  googleConnected: boolean;
} {
  return {
    id: session?.id,
    user: session?.google?.user,
    googleConnected: Boolean(session?.google),
  };
}

export function buildSessionCookie(
  sessionId: string,
  secure = false,
): SessionCookieDescriptor {
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    secure,
  };
}

function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return undefined;
}
