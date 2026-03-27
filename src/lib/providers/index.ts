import type { ProviderAdapter, ProviderId, ProviderStatus } from "../types";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { geminiProvider } from "./gemini";

const providers: Record<ProviderId, ProviderAdapter> = {
  claude: claudeProvider,
  codex: codexProvider,
  gemini: geminiProvider,
};

export function getProvider(providerId: ProviderId): ProviderAdapter {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}

export async function listProviderStatuses(
  context?: Parameters<ProviderAdapter["getStatus"]>[0],
): Promise<ProviderStatus[]> {
  return Promise.all(
    Object.values(providers).map((provider) => provider.getStatus(context)),
  );
}

export function listProviderIds(): ProviderId[] {
  return Object.keys(providers) as ProviderId[];
}
