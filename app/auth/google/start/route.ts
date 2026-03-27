import { NextRequest, NextResponse } from "next/server";

import { getGoogleAuthStartUrl } from "@/src/lib/google-oauth";
import {
  ensureRequestSession,
  applySessionCookie,
  getRequestOrigin,
} from "@/src/lib/next-route";

export async function GET(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const location = getGoogleAuthStartUrl(getRequestOrigin(request), session);
  const response = NextResponse.redirect(location);
  applySessionCookie(response, cookie);
  return response;
}

