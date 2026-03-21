
from dataclasses import dataclass

@dataclass(frozen=True)
class FoundationSummary:
    artifact: str
    governance: str
    release_version: str
    status: str

def describe_foundation() -> str:
    summary = FoundationSummary(
        artifact="ShellRPG-server",
        governance="SERVER-PRIVAT",
        release_version="v0.4.0",
        status="Phase E cities + militia + autobattle + standalone-ready slice on http://127.0.0.1:8765",
    )
    return f"{summary.artifact} | {summary.governance} | {summary.release_version} | {summary.status}"
