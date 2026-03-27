import { NextRequest, NextResponse } from "next/server";

import {
  ensureRequestSession,
  applySessionCookie,
  getRequestOrigin,
} from "@/src/lib/next-route";
import { chatWithChapter, parseChapterChatRequest } from "@/src/lib/service";

export async function POST(request: NextRequest) {
  const { session, cookie } = ensureRequestSession(request);
  const body = await request.json();
  const parsed = parseChapterChatRequest(body);

  const result = await chatWithChapter(
    parsed.url,
    parsed.provider,
    parsed.chapterId,
    parsed.messages,
    {
      requestOrigin: getRequestOrigin(request),
      session,
    },
  );

  const response = NextResponse.json(result);
  applySessionCookie(response, cookie);
  return response;
}
