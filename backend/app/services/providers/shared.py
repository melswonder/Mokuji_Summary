import json
from asyncio import create_subprocess_exec, wait_for
from asyncio.subprocess import PIPE


class CommandFailure(RuntimeError):
    def __init__(self, command: str, exit_code: int, stdout: str, stderr: str) -> None:
        super().__init__(f"{command} exited with code {exit_code}")
        self.stdout = stdout
        self.stderr = stderr


async def run_command(command: str, *args: str, timeout: int = 120) -> tuple[str, str]:
    process = await create_subprocess_exec(command, *args, stdout=PIPE, stderr=PIPE)
    stdout, stderr = await wait_for(process.communicate(), timeout=timeout)
    text_stdout = stdout.decode("utf-8", "ignore")
    text_stderr = stderr.decode("utf-8", "ignore")
    if process.returncode != 0:
        raise CommandFailure(command, process.returncode or -1, text_stdout, text_stderr)
    return text_stdout, text_stderr


def parse_summary_json(value: str) -> dict:
    payload = json.loads(value)
    return {
        "summary": payload.get("summary", ""),
        "keyTopics": payload.get("keyTopics", []),
        "targetAudience": payload.get("targetAudience", []),
        "confidence": payload.get("confidence", "low"),
        "evidence": payload.get("evidence", []),
        "limitations": payload.get("limitations", []),
    }
