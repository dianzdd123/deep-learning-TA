#!/usr/bin/env python3
"""Build an auditable, public course-content excerpt index for Diana.

Run: python scripts/build_materials.py
Supported: .md, .txt, .ipynb, .pdf (PDF requires pypdf installed)
All listed paths must reside in materials/. Do not include confidential files.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "materials" / "manifest.json"
OUTPUT = ROOT / "data" / "materials-index.json"
MAX_CHARS = 1250
OVERLAP = 120
MAX_FILE_CHARS = 300_000


def read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in (".md", ".txt"):
        return path.read_text(encoding="utf-8")
    if suffix == ".ipynb":
        notebook = json.loads(path.read_text(encoding="utf-8"))
        parts = []
        for cell in notebook.get("cells", []):
            if cell.get("cell_type") in ("markdown", "code"):
                source = cell.get("source", "")
                parts.append("".join(source) if isinstance(source, list) else str(source))
        return "\n\n".join(parts)
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("PDF indexing requires: python -m pip install pypdf") from exc
        reader = PdfReader(str(path))
        return "\n\n".join(f"[PDF page {i + 1}]\n{p.extract_text() or ''}" for i, p in enumerate(reader.pages))
    raise ValueError(f"Unsupported file extension: {suffix}")


def chunks(text: str):
    text = "\n".join(line.strip() for line in text.splitlines()).strip()
    if not text:
        return
    index = 0
    start = 0
    while start < len(text):
        end = min(start + MAX_CHARS, len(text))
        if end < len(text):
            split = text.rfind("\n", start + MAX_CHARS // 2, end)
            if split > start:
                end = split
        excerpt = text[start:end].strip()
        if excerpt:
            yield index, excerpt
            index += 1
        if end == len(text):
            break
        start = max(start + 1, end - OVERLAP)


def build() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = manifest.get("documents", [])
    output = {
        "version": manifest.get("version", "unversioned"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "documents": [],
        "chunks": [],
    }
    for doc in records:
        relative = doc["path"]
        path = (ROOT / relative).resolve()
        if not path.is_relative_to((ROOT / "materials").resolve()) or not path.is_file():
            raise ValueError(f"Material path is missing or outside materials/: {relative}")
        content = read_text(path)
        if len(content) > MAX_FILE_CHARS:
            raise ValueError(f"File exceeds {MAX_FILE_CHARS} characters: {relative}")
        doc_id = doc["id"]
        title = doc["title"]
        authority = doc.get("authority", "teaching-notes")
        base = {"id": doc_id, "title": title, "path": relative, "authority": authority}
        output["documents"].append(base)
        for chunk_index, excerpt in chunks(content):
            output["chunks"].append({
                **base,
                "chunk_index": chunk_index,
                "text": excerpt,
                "url": "./" + relative,
            })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Indexed {len(output['documents'])} documents / {len(output['chunks'])} excerpts -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
