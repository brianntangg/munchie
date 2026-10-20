import os
import sys
from pathlib import Path

from supabase import create_client


BUCKET = "menus"
REMOTE_PATH = "vanderbilt_all_menus.json"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python upload_menu_json.py PATH", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"Menu file not found: {path}", file=sys.stderr)
        return 1

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
            file=sys.stderr,
        )
        return 2

    client = create_client(url, key)
    client.storage.from_(BUCKET).upload(
        REMOTE_PATH,
        path.read_bytes(),
        {
            "content-type": "application/json",
            "upsert": "true",
        },
    )
    print(f"Uploaded {path} to {BUCKET}/{REMOTE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
