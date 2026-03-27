import { NextRequest, NextResponse } from "next/server";

import { ensureRequestSession, applySessionCookie } from "@/src/lib/next-route";
import { clearGoogleSession } from "@/src/lib/session";

export async function POST(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  clearGoogleSession(session);

  const response = NextResponse.json({ ok: true });
  applySessionCookie(response, cookie);
  return response;
}

