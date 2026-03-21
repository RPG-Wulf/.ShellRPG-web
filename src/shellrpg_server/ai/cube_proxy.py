
from __future__ import annotations

import os

SPECIAL_42_ALIASES = {"die endgültige frage nach dem leben, dem universum und dem ganzen rest", "die endgueltige frage nach dem leben, dem universum und dem ganzen rest"}

OFFLINE_RESPONSES = {
    "de": [
        "Der Kubus dreht sich kaum merklich. „Deine Shell riecht nach Unsicherheit und warmem Kupfer.“",
        "„Menschen. Immer dieselbe Mischung aus Ehrgeiz, Prompt und Tippfehler.“",
        "„Dein Bash ist nicht beeindruckend. Es ist nur lauter als deine Gedanken.“",
        "„Sprich präziser. Selbst eure Terminals leiden unter eurer Syntax.“",
        "„Ich schwebe seit Äonen. Du stolperst seit drei Befehlen.“",
    ],
    "en": [
        "The cube barely turns. “Your shell smells of uncertainty and warm copper.”",
        "“Humans. Always the same blend of ambition, prompt, and typo.”",
        "“Your bash is not impressive. It is merely louder than your thoughts.”",
        "“Be precise. Even your terminals suffer from your syntax.”",
        "“I have floated for aeons. You have stumbled for three commands.”",
    ],
}

def _offline_response(question: str, language: str = "de") -> str:
    q = (question or "").strip().lower()
    if q.rstrip(" ?!").replace("ä","ae").replace("ö","oe").replace("ü","ue") in SPECIAL_42_ALIASES:
        return "42"
    pool = OFFLINE_RESPONSES["de" if language not in {"de","en"} else language]
    idx = abs(hash(q)) % len(pool)
    base = pool[idx]
    if "bash" in q or "zsh" in q or "terminal" in q or "shell" in q:
        extra = " „Und nein, ich werde mich nicht vor deinem Prompt verbeugen.“" if language == "de" else ' “And no, I will not bow to your prompt.”'
        return base + extra
    return base

def call_cube_agent(question: str, language: str = "de") -> list[str]:
    """
    Server-side proxy target for a future OpenAI integration.
    In this offline build, it returns deterministic chunks and honors the 42 easter egg.
    """
    # Reserved environment flag for future online integration.
    _ = os.getenv("OPENAI_API_KEY")
    text = _offline_response(question, language)
    if text == "42":
        return ["42"]
    # simple scrobble chunks
    words = text.split()
    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= 4:
            chunks.append(" ".join(current))
            current = []
    if current:
        chunks.append(" ".join(current))
    return chunks
