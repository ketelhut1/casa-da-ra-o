# -*- coding: utf-8 -*-
"""Extrai a tabela de racoes_valores.docx para JSON e SQLite."""
import json
import sqlite3
from pathlib import Path

from docx import Document

ROOT = Path(__file__).resolve().parent
DOCX = ROOT / "racoes_valores.docx"
JSON_OUT = ROOT / "racoes.json"
DB_OUT = ROOT / "racoes.db"
SITE_JSON = ROOT / "site" / "racoes.json"


def main():
    doc = Document(str(DOCX))
    table = doc.tables[0]
    rows_out = []

    for row in table.rows[1:]:
        cells = [c.text.strip().replace("\n", " ") for c in row.cells]
        if len(cells) < 5:
            continue
        codigo, descricao, custo_unit, saldo, total = cells[:5]
        if not codigo and not descricao:
            continue
        rows_out.append(
            {
                "codigo": codigo,
                "descricao": descricao,
                "custo_unit": custo_unit,
                "saldo": saldo,
                "total": total,
            }
        )

    JSON_OUT.write_text(json.dumps(rows_out, ensure_ascii=False, indent=2), encoding="utf-8")
    SITE_JSON.parent.mkdir(parents=True, exist_ok=True)
    SITE_JSON.write_text(json.dumps(rows_out, ensure_ascii=False), encoding="utf-8")

    conn = sqlite3.connect(str(DB_OUT))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS racoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            custo_unit TEXT,
            saldo TEXT,
            total TEXT
        )
        """
    )
    conn.execute("DELETE FROM racoes")
    conn.executemany(
        "INSERT INTO racoes (codigo, descricao, custo_unit, saldo, total) VALUES (?,?,?,?,?)",
        [
            (r["codigo"], r["descricao"], r["custo_unit"], r["saldo"], r["total"])
            for r in rows_out
        ],
    )
    conn.commit()
    conn.close()

    print(f"Exportadas {len(rows_out)} racoes para {JSON_OUT.name}, {DB_OUT.name}, {SITE_JSON}")


if __name__ == "__main__":
    main()
