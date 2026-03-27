import { NextRequest, NextResponse } from "next/server";

import { ensureRequestSession, applySessionCookie } from "@/src/lib/next-route";
import { parseInspectRequest, inspectUrl } from "@/src/lib/service";

export async function POST(request: NextRequest) {
  const { cookie } = ensureRequestSession(request);
  const body = await request.json();
  const parsed = parseInspectRequest(body);

  const response = NextResponse.json({
    inspection: await inspectUrl(parsed.url),
  });
  applySessionCookie(response, cookie);
  return response;
}
