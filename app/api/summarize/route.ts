import { NextRequest, NextResponse } from "next/server";

import {
  ensureRequestSession,
  applySessionCookie,
  getRequestOrigin,
} from "@/src/lib/next-route";
import { analyzeUrl, parseSummarizeRequest } from "@/src/lib/service";

export async function POST(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const body = await request.json();
  const parsed = parseSummarizeRequest(body);

  const result = await analyzeUrl(parsed.url, parsed.provider, {
    requestOrigin: getRequestOrigin(request),
    session,
  });

  const response = NextResponse.json(result);
  applySessionCookie(response, cookie);
  return response;
}

