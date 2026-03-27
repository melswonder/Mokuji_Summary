import { NextRequest, NextResponse } from "next/server";

import { isGoogleOAuthConfigured } from "@/src/lib/google-oauth";
import { ensureRequestSession, applySessionCookie } from "@/src/lib/next-route";
import { serializeSession } from "@/src/lib/session";

export async function GET(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const response = NextResponse.json({
    session: serializeSession(session),
    oauth: {
      googleConfigured: isGoogleOAuthConfigured(),
    },
  });
  applySessionCookie(response, cookie);
  return response;
}

