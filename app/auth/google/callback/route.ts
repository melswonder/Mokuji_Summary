import { NextRequest, NextResponse } from "next/server";

import { completeGoogleOAuth } from "@/src/lib/google-oauth";
import {
  ensureRequestSession,
  applySessionCookie,
  getRequestOrigin,
} from "@/src/lib/next-route";

export async function GET(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? undefined;

  if (!code) {
    throw new Error("Google OAuth callback に code がありません。");
  }

  await completeGoogleOAuth(getRequestOrigin(request), session, code, state);
  const response = NextResponse.redirect(
    new URL("/?auth=google-success", request.nextUrl.origin),
  );
  applySessionCookie(response, cookie);
  return response;
}

