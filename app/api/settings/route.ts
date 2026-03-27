import { NextRequest, NextResponse } from "next/server";

import {
  getEffectiveSettings,
  getStoredSettings,
  parseSettingsUpdate,
  saveSettings,
} from "@/src/lib/settings";
import { ensureRequestSession, applySessionCookie } from "@/src/lib/next-route";
import { serializeSession } from "@/src/lib/session";

export async function GET(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const response = NextResponse.json({
    settings: getEffectiveSettings(),
    storedSettings: getStoredSettings(),
    session: serializeSession(session),
  });
  applySessionCookie(response, cookie);
  return response;
}

export async function POST(request: NextRequest) {
  const { cookie } = ensureRequestSession(request);
  const body = await request.json();
  const update = parseSettingsUpdate(body);
  const storedSettings = await saveSettings(update);
  const response = NextResponse.json({
    ok: true,
    settings: getEffectiveSettings(),
    storedSettings,
  });
  applySessionCookie(response, cookie);
  return response;
}
