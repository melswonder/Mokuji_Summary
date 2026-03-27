import json


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "keyTopics": {"type": "array", "items": {"type": "string"}},
        "targetAudience": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "summary",
        "keyTopics",
        "targetAudience",
        "confidence",
        "evidence",
        "limitations",
    ],
}


def build_summary_prompt(book: dict) -> str:
    return (
        "あなたは本の目次から内容を推定するアシスタントです。"
        "次の本について日本語で簡潔に要約し、JSON だけを返してください。\n"
        f"{json.dumps(book, ensure_ascii=False, indent=2)}"
    )


def build_chat_prompt(book: dict, chapter: dict, messages: list[dict]) -> str:
    transcript = "\n".join(f"{item['role']}: {item['content']}" for item in messages)
    return (
        "あなたは本の章目次だけを前提に質問へ答えるアシスタントです。"
        "不明な内容は推測しすぎず、その旨を明示してください。\n"
        f"Book:\n{json.dumps(book, ensure_ascii=False, indent=2)}\n"
        f"Chapter:\n{json.dumps(chapter, ensure_ascii=False, indent=2)}\n"
        f"Conversation:\n{transcript}"
    )
