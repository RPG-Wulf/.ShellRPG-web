from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
import mimetypes
from pathlib import Path, PurePosixPath
import time
import tomllib
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from shellrpg_www.config import WWWConfig


SAFE_ASSET_SUFFIXES = {
    ".css",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".png",
    ".svg",
    ".webp",
}

ALLOWED_ASSET_PREFIXES = (
    "public/media/",
)

CONTENT_TYPE_OVERRIDES = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
}

REMOTE_FAILURE_COOLDOWN_SECONDS = 45.0
_REMOTE_FAILURE_CACHE: dict[str, float] = {}


@dataclass(frozen=True)
class AssetPayload:
    body: bytes
    content_type: str
    source: str


def normalize_asset_path(request_path: str, route_prefix: str = "/asset") -> str | None:
    route_prefix = "/" + route_prefix.strip("/") if route_prefix else "/asset"
    path = urlsplit(request_path).path
    if not path.startswith(route_prefix + "/"):
        return None
    relative = path[len(route_prefix) + 1 :]
    pure = PurePosixPath(relative)
    if not relative or pure.is_absolute() or ".." in pure.parts:
        return None
    if pure.suffix.lower() not in SAFE_ASSET_SUFFIXES:
        return None
    normalized = "/".join(pure.parts)
    if not normalized.startswith(ALLOWED_ASSET_PREFIXES):
        return None
    return normalized


def guess_content_type(path: str | Path) -> str:
    suffix = Path(path).suffix.lower()
    override = CONTENT_TYPE_OVERRIDES.get(suffix)
    if override:
        return override
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def build_remote_asset_url(base_url: str, asset_path: str) -> str:
    return base_url.rstrip("/") + "/" + asset_path.lstrip("/")


def load_extra_asset_origins(path: str | None) -> tuple[str, ...]:
    if not path:
        return ()
    candidate = Path(path)
    if not candidate.exists():
        return ()
    with candidate.open("rb") as fh:
        data = tomllib.load(fh)
    origins = data.get("origins", {}) if isinstance(data, dict) else {}
    extra = origins.get("additional_base_urls", []) if isinstance(origins, dict) else []
    if isinstance(extra, str):
        extra = [extra]
    return tuple(str(value).strip() for value in extra if str(value).strip())


def candidate_remote_bases(config: WWWConfig) -> tuple[str, ...]:
    values = [
        config.asset_primary_base_url,
        *config.asset_fallback_base_urls,
        *load_extra_asset_origins(config.asset_origin_candidates_path),
    ]
    deduped: list[str] = []
    for value in values:
        clean = value.strip()
        if clean and clean not in deduped:
            deduped.append(clean)
    return tuple(deduped)


def candidate_local_roots(root: Path) -> tuple[Path, ...]:
    bundle_root = root.parent
    values = [
        bundle_root / "ShellRPG-cdn" / "assets" / "www",
        root,
    ]
    deduped: list[Path] = []
    for value in values:
        resolved = value.resolve()
        if resolved not in deduped:
            deduped.append(resolved)
    return tuple(deduped)


def resolve_local_asset(root: Path, asset_path: str) -> Path | None:
    for base in candidate_local_roots(root):
        target = (base / Path(*PurePosixPath(asset_path).parts)).resolve()
        try:
            target.relative_to(base)
        except ValueError:
            continue
        if target.is_file():
            return target
    return None


def _fetch_remote(url: str, timeout_seconds: float) -> AssetPayload | None:
    request = Request(url, headers={"User-Agent": "ShellRPG-www-asset-proxy/0.7.6"})
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return AssetPayload(
                body=response.read(),
                content_type=response.headers.get("Content-Type", guess_content_type(url)),
                source=url,
            )
    except (HTTPError, URLError, TimeoutError, OSError):
        _REMOTE_FAILURE_CACHE[url] = time.time()
        return None


def fetch_first_remote_asset(urls: tuple[str, ...], timeout_seconds: float) -> AssetPayload | None:
    if not urls:
        return None
    now = time.time()
    healthy = [
        url
        for url in urls
        if now - _REMOTE_FAILURE_CACHE.get(url, 0.0) >= REMOTE_FAILURE_COOLDOWN_SECONDS
    ]
    ordered = tuple(healthy) + tuple(url for url in urls if url not in healthy)
    with ThreadPoolExecutor(max_workers=max(1, min(len(ordered), 4))) as pool:
        future_map: dict[Future[AssetPayload | None], str] = {
            pool.submit(_fetch_remote, url, timeout_seconds): url for url in ordered
        }
        pending = set(future_map)
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for future in done:
                payload = future.result()
                if payload is not None:
                    for leftover in pending:
                        leftover.cancel()
                    return payload
    return None


def load_asset_payload(config: WWWConfig, root: Path, request_path: str) -> AssetPayload | None:
    asset_path = normalize_asset_path(request_path, route_prefix=config.asset_proxy_route)
    if not asset_path:
        return None
    remote_urls = tuple(build_remote_asset_url(base, asset_path) for base in candidate_remote_bases(config))
    remote = fetch_first_remote_asset(remote_urls, timeout_seconds=config.asset_request_timeout_seconds)
    if remote is not None:
        return remote
    local = resolve_local_asset(root, asset_path)
    if local is None:
        return None
    return AssetPayload(body=local.read_bytes(), content_type=guess_content_type(local), source=str(local))
