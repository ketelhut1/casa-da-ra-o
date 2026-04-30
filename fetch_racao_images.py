# -*- coding: utf-8 -*-
"""
Busca imagens na web (DuckDuckGo) pelo nome da ração e salva em site/images/<codigo>.jpg
Execute: python fetch_racao_images.py
Opções: --force (baixa de novo mesmo se já existir), --limit N (só os N primeiros)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests
from duckduckgo_search import DDGS

ROOT = Path(__file__).resolve().parent
JSON_PATH = ROOT / "racoes.json"
IMAGES_DIR = ROOT / "site" / "images"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def safe_codigo(codigo: str) -> str:
    s = (codigo or "").strip()
    if not s:
        return "sem_codigo"
    return re.sub(r'[<>:"/\\|?*]', "_", s)


def is_probably_image(content: bytes) -> bool:
    if len(content) < 2000:
        return False
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if content[:2] == b"\xff\xd8":
        return True
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return True
    return False


def download_one(url: str, dest: Path, timeout: int = 35) -> bool:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        data = r.content
        if len(data) > 8 * 1024 * 1024:
            return False
        if not is_probably_image(data):
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return dest.stat().st_size > 2000
    except Exception:
        return False


def search_urls(query: str, max_results: int = 8) -> list[str]:
    urls: list[str] = []
    try:
        with DDGS() as ddgs:
            for item in ddgs.images(query, max_results=max_results):
                u = item.get("image") or item.get("thumbnail")
                if u and u.startswith("http"):
                    urls.append(u)
    except Exception:
        pass
    return urls


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Sobrescrever imagens existentes")
    parser.add_argument("--limit", type=int, default=0, help="Máximo de itens (0 = todos)")
    parser.add_argument("--delay", type=float, default=1.25, help="Segundos entre buscas")
    args = parser.parse_args()

    if not JSON_PATH.is_file():
        print("racoes.json não encontrado. Rode build_data.py antes.", file=sys.stderr)
        return 1

    items = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    done = skip = fail = 0
    total = len(items) if args.limit <= 0 else min(args.limit, len(items))

    for i, row in enumerate(items):
        if args.limit > 0 and i >= args.limit:
            break
        codigo = safe_codigo(row.get("codigo", ""))
        desc = (row.get("descricao") or "").strip()
        if not desc:
            fail += 1
            continue

        dest = IMAGES_DIR / f"{codigo}.jpg"
        if dest.is_file() and dest.stat().st_size > 2000 and not args.force:
            skip += 1
            if (skip + done + fail) % 50 == 0:
                print(f"... {i+1}/{total} (pulando já existentes)")
            continue

        query = f"{desc} ração saco pet shop"
        urls = search_urls(query)
        ok = False
        for url in urls[:6]:
            if download_one(url, dest):
                ok = True
                break
            time.sleep(0.3)

        if ok:
            done += 1
            print(f"[OK] {codigo} — {desc[:55]}")
        else:
            fail += 1
            print(f"[--] {codigo} — sem imagem: {desc[:55]}")

        time.sleep(args.delay)

    print(f"Concluído: baixadas={done}, puladas={skip}, falhas={fail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
