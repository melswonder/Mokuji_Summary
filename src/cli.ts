import { inspectUrl, analyzeUrl } from "./lib/service";
import { listProviderStatuses } from "./lib/providers";
import type { ProviderId } from "./lib/types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "providers": {
      const providers = await listProviderStatuses();
      console.log(JSON.stringify({ providers }, null, 2));
      return;
    }

    case "inspect": {
      const url = args[1];
      if (!url) {
        throw new Error("Usage: pnpm cli inspect <url>");
      }
      const inspection = await inspectUrl(url);
      console.log(JSON.stringify({ inspection }, null, 2));
      return;
    }

    case "summarize": {
      const url = args[1];
      const provider = parseProviderFlag(args.slice(2));
      if (!url) {
        throw new Error("Usage: pnpm cli summarize <url> --provider codex");
      }
      if (provider === "gemini") {
        throw new Error(
          "`gemini` は Web OAuth セッション前提なので、いまは HTTP API / Web UI から使ってください。",
        );
      }
      const result = await analyzeUrl(url, provider);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    default:
      printUsage();
  }
}

function parseProviderFlag(args: string[]): ProviderId {
  const providerIndex = args.findIndex((arg) => arg === "--provider");
  if (providerIndex === -1) {
    return "codex";
  }

  const candidate = args[providerIndex + 1];
  if (candidate === "claude" || candidate === "codex" || candidate === "gemini") {
    return candidate;
  }

  throw new Error("`--provider` には `gemini` `claude` `codex` のいずれかを指定してください。");
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  pnpm cli providers",
      "  pnpm cli inspect <url>",
      "  pnpm cli summarize <url> --provider gemini|codex|claude",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
