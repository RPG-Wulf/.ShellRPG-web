from __future__ import annotations

import argparse
from dataclasses import replace

from shellrpg_www.config import load_www_config
from shellrpg_www.dynv6 import update_dynv6_from_local_secret
from shellrpg_www.gateway import run_gateway
from shellrpg_www.version import RELEASE_VERSION


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=f"ShellRPG public web gateway {RELEASE_VERSION}")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", default=None, type=int)
    parser.add_argument("--backend", default=None, help="Interne Basis-URL des privaten ShellRPG-Servers.")
    parser.add_argument("--config", default="config/shellrpg-www.toml")
    args = parser.parse_args(argv)

    config = load_www_config(args.config)
    config = replace(
        config,
        host=args.host or config.host,
        port=args.port or config.port,
        backend_base_url=args.backend or config.backend_base_url,
    )
    try:
        dynv6_result = update_dynv6_from_local_secret()
    except Exception as exc:
        print(f"dynv6 update skipped: {exc}")
    else:
        if dynv6_result:
            print(f"dynv6 update completed for ShellRPG-www: {dynv6_result}")
    run_gateway(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
