import { NextRequest, NextResponse } from "next/server";

import { ensureRequestSession, applySessionCookie, getRequestOrigin } from "@/src/lib/next-route";
import { listProviderStatuses } from "@/src/lib/providers";

export async function GET(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const response = NextResponse.json({
    providers: await listProviderStatuses({
      requestOrigin: getRequestOrigin(request),
      session,
    }),
  });
  applySessionCookie(response, cookie);
  return response;
}

