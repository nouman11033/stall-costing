#!/usr/bin/env python3
"""
Poll a Poker Now public player profile and notify when the season "played games"
count (currentSeasonRank.disputedTournaments) increases.

Free options (no SMS charges):
  ntfy — install the "ntfy" app (Android/iOS), pick a secret topic name, set:
    NTFY_TOPIC=your-long-random-secret
    (optional) NTFY_SERVER=https://ntfy.sh  (default)
  telegram — create a bot with @BotFather, then set:
    TELEGRAM_BOT_TOKEN=...
    TELEGRAM_CHAT_ID=...   (your user id; message the bot first)

Paid / carrier SMS:
  twilio — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_E164, NOTIFY_TO_E164

Example (free ntfy):
  export NTFY_TOPIC='pokernow-alerts-mySecretPhrase9k2'
  python3 scripts/pokernow_played_games_watcher.py --interval-seconds 300

Auto mode (default): uses ntfy if NTFY_TOPIC is set, else Telegram if bot vars are set,
else Twilio if all Twilio vars are set; otherwise you must set one of those or use --notify print.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def extract_window_player_data(html: str) -> dict[str, Any]:
    marker = "window.playerData = "
    i = html.find(marker)
    if i == -1:
        raise ValueError("Could not find window.playerData in HTML (page layout changed?)")
    start = html.find("{", i)
    if start == -1:
        raise ValueError("Malformed window.playerData assignment")
    depth = 0
    for j in range(start, len(html)):
        c = html[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                blob = html[start : j + 1]
                return json.loads(blob)
    raise ValueError("Unterminated JSON for window.playerData")


def played_games_count(player_data: dict[str, Any]) -> Optional[int]:
    rank = player_data.get("currentSeasonRank")
    if not isinstance(rank, dict):
        return None
    raw = rank.get("disputedTournaments")
    if raw is None:
        return None
    return int(str(raw))


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def ntfy_post_url() -> str:
    raw = (os.environ.get("NTFY_TOPIC") or "").strip()
    if not raw:
        raise RuntimeError("Set NTFY_TOPIC to a long random topic name (this is your password).")
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw.rstrip("/")
    server = (os.environ.get("NTFY_SERVER") or "https://ntfy.sh").rstrip("/")
    topic = urllib.parse.quote(raw, safe="")
    return f"{server}/{topic}"


def send_ntfy(body: str) -> None:
    url = ntfy_post_url()
    title = (os.environ.get("NTFY_TITLE") or "Poker Now").strip() or "Poker Now"
    req = urllib.request.Request(
        url,
        data=body.encode("utf-8"),
        method="POST",
        headers={"Title": title},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        resp.read()


def send_telegram(body: str) -> None:
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    if not token or not chat:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.")
    api = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat, "text": body}).encode("utf-8")
    req = urllib.request.Request(
        api,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        resp.read()


def send_twilio_sms(body: str) -> None:
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_no = os.environ.get("TWILIO_FROM_E164")
    to_no = os.environ.get("NOTIFY_TO_E164")
    missing = [k for k, v in [
        ("TWILIO_ACCOUNT_SID", sid),
        ("TWILIO_AUTH_TOKEN", token),
        ("TWILIO_FROM_E164", from_no),
        ("NOTIFY_TO_E164", to_no),
    ] if not v]
    if missing:
        raise RuntimeError("Missing env for Twilio: " + ", ".join(missing))
    post = urllib.parse.urlencode({
        "To": to_no,
        "From": from_no,
        "Body": body,
    }).encode("utf-8")
    auth = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
    api = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    req = urllib.request.Request(
        api,
        data=post,
        method="POST",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        resp.read()


def load_state(path: Path) -> Optional[int]:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data.get("last_count"), int):
            return data["last_count"]
    except (json.JSONDecodeError, OSError):
        pass
    return None


def save_state(path: Path, last_count: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"last_count": last_count}, indent=2) + "\n",
        encoding="utf-8",
    )


def resolve_notify_mode(cli: str) -> str:
    if cli != "auto":
        return cli
    if (os.environ.get("NTFY_TOPIC") or "").strip():
        return "ntfy"
    if (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip() and (
        os.environ.get("TELEGRAM_CHAT_ID") or ""
    ).strip():
        return "telegram"
    if all(
        os.environ.get(k)
        for k in (
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM_E164",
            "NOTIFY_TO_E164",
        )
    ):
        return "twilio"
    return "ntfy"


def validate_notify(mode: str) -> Optional[str]:
    if mode == "twilio":
        for key in (
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM_E164",
            "NOTIFY_TO_E164",
        ):
            if not os.environ.get(key):
                return f"Twilio mode needs {key} set (or use --notify ntfy / telegram / print)."
    if mode == "ntfy":
        if not (os.environ.get("NTFY_TOPIC") or "").strip():
            return (
                "Set NTFY_TOPIC to a long random string (secret), install the ntfy app, "
                "subscribe to that topic — free push. Or use --notify telegram / twilio / print. "
                "See script docstring."
            )
    if mode == "telegram":
        if not (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip() or not (
            os.environ.get("TELEGRAM_CHAT_ID") or ""
        ).strip():
            return "telegram mode needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID."
    return None


def send_notify(mode: str, msg: str) -> None:
    if mode == "ntfy":
        send_ntfy(msg)
    elif mode == "telegram":
        send_telegram(msg)
    elif mode == "twilio":
        send_twilio_sms(msg)
    elif mode == "print":
        print(f"NOTIFY: {msg}", flush=True)
    else:
        raise RuntimeError(f"Unknown notify mode: {mode}")


def main() -> int:
    p = argparse.ArgumentParser(
        description="Notify when Poker Now season played-games count increases.",
    )
    p.add_argument(
        "--url",
        default=os.environ.get(
            "POKERNOW_PLAYER_URL",
            "https://www.pokernow.com/players/ghdcriogVg",
        ),
        help="Public player profile URL",
    )
    p.add_argument(
        "--interval-seconds",
        type=int,
        default=int(os.environ.get("POLL_INTERVAL_SECONDS", "120")),
        help="Seconds between checks (default 120)",
    )
    p.add_argument(
        "--state-file",
        type=Path,
        default=Path(os.environ.get("STATE_FILE", str(Path.home() / ".pokernow_watcher_state.json"))),
        help="Where to store last seen count",
    )
    p.add_argument(
        "--notify",
        choices=("auto", "ntfy", "telegram", "twilio", "print"),
        default=os.environ.get("NOTIFY_METHOD", "auto"),
        help="How to alert: auto (pick from env), ntfy, telegram, twilio, or print (console only)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print what would be sent; do not call ntfy/Telegram/Twilio",
    )
    args = p.parse_args()
    args.notify = resolve_notify_mode(args.notify)

    err = validate_notify(args.notify)
    if err and not args.dry_run:
        print(err, file=sys.stderr)
        return 1

    if args.interval_seconds < 30:
        print("interval-seconds below 30 may annoy Poker Now; consider 60+", file=sys.stderr)

    print(f"Watching {args.url} every {args.interval_seconds}s", flush=True)
    print("Metric: currentSeasonRank.disputedTournaments (season played games)", flush=True)
    print(f"Notify: {args.notify}" + (" (dry-run)" if args.dry_run else ""), flush=True)

    while True:
        try:
            html = fetch_html(args.url)
            pdata = extract_window_player_data(html)
            count = played_games_count(pdata)
            username = pdata.get("username", "?")

            if count is None:
                print(
                    "No currentSeasonRank.disputedTournaments on this profile "
                    "(layout or account type may differ). Not updating state.",
                    flush=True,
                )
            else:
                prev = load_state(args.state_file)
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {username} played games: {count}", flush=True)

                if prev is not None and count > prev:
                    msg = (
                        f"Poker Now: {username} played games increased {prev} -> {count}. "
                        f"{args.url}"
                    )
                    if args.dry_run:
                        print(f"DRY-RUN: {msg}", flush=True)
                    else:
                        send_notify(args.notify, msg)
                        print("Notification sent.", flush=True)

                if prev is None or count != prev:
                    save_state(args.state_file, count)

        except urllib.error.HTTPError as e:
            print(f"HTTP error: {e.code} {e.reason}", file=sys.stderr, flush=True)
        except urllib.error.URLError as e:
            print(f"Network error: {e}", file=sys.stderr, flush=True)
        except (ValueError, json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"Parse error: {e}", file=sys.stderr, flush=True)
        except RuntimeError as e:
            print(str(e), file=sys.stderr, flush=True)

        time.sleep(max(1, args.interval_seconds))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
