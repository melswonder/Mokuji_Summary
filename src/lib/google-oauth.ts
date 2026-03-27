import { randomUUID } from "node:crypto";

import {
  clearOauthState,
  setGoogleSession,
  setOauthState,
} from "./session";
import { getEffectiveSettings } from "./settings";
import type { AppSession, SessionUser } from "./types";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/cloud-platform",
];

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  projectId?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export function isGoogleOAuthConfigured(): boolean {
  const settings = getEffectiveSettings();
  return Boolean(
    settings.api.googleClientId && settings.api.googleClientSecret,
  );
}

export function getGoogleProjectId(): string | undefined {
  return getEffectiveSettings().api.googleCloudProjectId || undefined;
}

export function getGoogleAuthStartUrl(
  origin: string,
  session: AppSession,
): string {
  const config = getOAuthConfig(origin);
  const state = randomUUID();
  setOauthState(session, state);

  const url = new URL(GOOGLE_AUTH_BASE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function completeGoogleOAuth(
  origin: string,
  session: AppSession,
  code: string,
  state: string | undefined,
): Promise<void> {
  const config = getOAuthConfig(origin);
  if (!session.oauthState || !state || state !== session.oauthState) {
    throw new Error("Google OAuth state の検証に失敗しました。");
  }

  const tokens = await exchangeCodeForTokens(config, code);
  const profile = await fetchGoogleUserProfile(tokens.access_token);

  setGoogleSession(session, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.google?.refreshToken,
    expiryDate: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    user: profile,
  });

  clearOauthState(session);
}

export async function ensureFreshGoogleAccessToken(
  origin: string,
  session: AppSession,
): Promise<string> {
  const config = getOAuthConfig(origin);
  const google = session.google;

  if (!google) {
    throw new Error("Google OAuth セッションがありません。先に Google 連携してください。");
  }

  const refreshThresholdMs = 60_000;
  if (google.expiryDate > Date.now() + refreshThresholdMs) {
    return google.accessToken;
  }

  if (!google.refreshToken) {
    throw new Error("Google の refresh token がありません。再ログインしてください。");
  }

  const refreshed = await refreshAccessToken(config, google.refreshToken);
  session.google = {
    ...google,
    accessToken: refreshed.access_token,
    expiryDate: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? google.scope,
  };

  return session.google.accessToken;
}

function getOAuthConfig(origin: string): OAuthConfig {
  const settings = getEffectiveSettings();
  const clientId = settings.api.googleClientId;
  const clientSecret = settings.api.googleClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth 用の環境変数が不足しています。`GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を設定してください。",
    );
  }

  const redirectUri =
    settings.api.googleRedirectUri || `${origin}/auth/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    projectId: settings.api.googleCloudProjectId || undefined,
  };
}

async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Google token exchange に失敗しました: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Google token refresh に失敗しました: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

async function fetchGoogleUserProfile(accessToken: string): Promise<SessionUser> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google userinfo 取得に失敗しました: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}
