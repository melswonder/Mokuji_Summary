import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandFailure extends Error {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, result: CommandResult) {
    super(message);
    this.name = "CommandFailure";
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
  }
}

interface RunCommandOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let timeoutId: NodeJS.Timeout | undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const result = {
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
      };

      if ((exitCode ?? -1) !== 0) {
        reject(
          new CommandFailure(
            `${command} exited with code ${result.exitCode}`,
            result,
          ),
        );
        return;
      }

      resolve(result);
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        reject(
          new Error(`${command} timed out after ${options.timeoutMs}ms`),
        );
      }, options.timeoutMs);
    }
  });
}

