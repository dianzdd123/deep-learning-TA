#!/usr/bin/env python3
"""Index *approved public* course materials for Diana with traceable page/slide metadata.

Usage: python -m pip install pypdf python-pptx
       python scripts/build_materials.py

Material manifest entries:
 {"id":"full-handbook","title":"DL Full Handbook 2026/27",
  "path":"materials/full-handbook.pdf","kind":"handbook","authority":"full-handbook"}
 {"id":"lecture1","title":"Lecture 1: Fundamentals",
  "path":"materials/lecture1.pptx","kind":"slides","authority":"lecture"}
Only approved public documents belong in materials/.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MATERIALS = (ROOT / "materials").resolve()
MANIFEST = MATERIALS / "manifest.json"
OUTPUT = ROOT / "data" / "materials-index.json"
CHUNK_SIZE = 1200
OVERLAP = 130
MAX_CHARS = 300_000


def iter_chunks(value: str):
    clean = "\n".join(line.rstrip() for line in value.splitlines()).strip()
    offset, index = 0, 0
    while offset < len(clean):
        end = min(offset + CHUNK_SIZE, len(clean))
        if end < len(clean):
            newline = clean.rfind("\n", offset + CHUNK_SIZE // 2, end)
            if newline > offset:
                end = newline
        text = clean[offset:end].strip()
        if text:
            yield index, text
            index += 1
        if end == len(clean):
            break
        offset = max(offset + 1, end - OVERLAP)


def units(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        for page, obj in enumerate(PdfReader(str(path)).pages, 1):
            yield {"page": page}, obj.extract_text() or ""
    elif suffix == ".pptx":
        from pptx import Presentation
        slides = Presentation(str(path))
        for slide_no, slide in enumerate(slides.slides, 1):
            texts = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    texts.append(shape.text)
                if shape.has_table:
                    for row in shape.table.rows:
                        texts.extend(cell.text for cell in row.cells)
            yield {"slide": slide_no}, "\n".join(texts)
    elif suffix == ".ipynb":
        data = json.loads(path.read_text(encoding="utf-8"))
        for idx, cell in enumerate(data.get("cells", []), 1):
            if cell.get("cell_type") in ("markdown", "code"):
                source = cell.get("source", "")
                content = "".join(source) if isinstance(source, list) else str(source)
                yield {"section": f"cell {idx}"}, content
    elif suffix in (".txt", ".md"):
        yield {"section": "document"}, path.read_text(encoding="utf-8")
    else:
        raise ValueError(f"Unsupported source: {path}")


def build():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    index = {"version": manifest.get("version", "unversioned"),
             "generated_at": datetime.now(timezone.utc).isoformat(),
             "documents": [], "chunks": []}
    ids = set()
    for doc in manifest.get("documents", []):
        path_text = str(doc["path"])
        path = (ROOT / path_text).resolve()
        if not path.is_relative_to(MATERIALS) or path == MANIFEST or not path.is_file():
            raise ValueError(f"Invalid material path (must be a file inside materials/): {path_text}")
        if doc["id"] in ids:
            raise ValueError(f"Duplicate document id: {doc['id']}")
        ids.add(doc["id"])
        kind = doc.get("kind", "tutorial")
        if kind not in ("handbook", "slides", "tutorial"):
            raise ValueError(f"Invalid document kind: {kind}")
        meta = {"id": doc["id"], "title": doc["title"], "path": path_text,
                "kind": kind, "authority": doc.get("authority", "teaching-notes")}
        if kind == "slides" and path.suffix.lower() != ".pptx":
            raise ValueError("Slides must be indexed from PPTX to establish slide numbers")
        if kind == "handbook" and path.suffix.lower() not in (".pdf", ".md", ".txt"):
            raise ValueError("Handbook must be a PDF or text-based source")
        index["documents"].append(meta)
        total = 0
        for position, content in units(path):
            total += len(content)
            if total > MAX_CHARS:
                raise ValueError(f"Document too long: {path_text}")
            for chunk_number, text in iter_chunks(content):
                index["chunks"].append({**meta, **position, "chunk_index": chunk_number, "text": text})
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Indexed {len(index['documents'])} documents and {len(index['chunks'])} excerpts -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
