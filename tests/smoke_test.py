import io
import os
import zipfile
import json
from typing import List

from fastapi.testclient import TestClient
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import pikepdf
from PIL import Image

import sys
ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.append(os.path.join(ROOT, "api"))

from app import app

client = TestClient(app)


def make_pdf(num_pages: int, label: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for idx in range(num_pages):
        c.drawString(100, 750, f"{label} page {idx + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


def make_pdf_with_metadata(num_pages: int, label: str) -> bytes:
    base = make_pdf(num_pages, label)
    out = io.BytesIO()
    with pikepdf.open(io.BytesIO(base)) as pdf:
        pdf.docinfo["/Author"] = "Test Author"
        pdf.docinfo["/Title"] = "Test Title"
        pdf.save(out)
    return out.getvalue()


def read_first_lines(pdf_bytes: bytes) -> List[str]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    lines: List[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        first_line = text.strip().splitlines()[0] if text.strip() else ""
        lines.append(first_line)
    return lines


def assert_pdf_page_count(pdf_bytes: bytes, expected: int) -> None:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == expected, f"expected {expected} pages, got {len(reader.pages)}"


failures: List[str] = []

try:
    pdf_a = make_pdf(2, "A")
    pdf_b = make_pdf(2, "B")
    files = [
        ("files", ("a.pdf", pdf_a, "application/pdf")),
        ("files", ("b.pdf", pdf_b, "application/pdf")),
    ]
    resp = client.post("/merge", files=files)
    assert resp.status_code == 200, resp.text
    assert_pdf_page_count(resp.content, 4)
except AssertionError as exc:
    failures.append(f"merge: {exc}")

try:
    pdf_c = make_pdf(4, "Split")
    resp = client.post(
        "/split",
        files={"file": ("split.pdf", pdf_c, "application/pdf")},
        data={"ranges": "1-2,3-4"},
    )
    assert resp.status_code == 200, resp.text
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        names = zf.namelist()
        assert len(names) == 2, f"expected 2 parts, got {names}"
        for name in names:
            data = zf.read(name)
            assert_pdf_page_count(data, 2)
except AssertionError as exc:
    failures.append(f"split: {exc}")

try:
    pdf_plain = make_pdf(1, "Secure")
    resp = client.post(
        "/protect",
        files={"file": ("plain.pdf", pdf_plain, "application/pdf")},
        data={"password": "secret"},
    )
    assert resp.status_code == 200, resp.text
    protected = resp.content
    with pikepdf.open(io.BytesIO(protected), password="secret"):
        pass
    resp = client.post(
        "/unlock",
        files={"file": ("protected.pdf", protected, "application/pdf")},
        data={"password": "secret"},
    )
    assert resp.status_code == 200, resp.text
    unlocked = resp.content
    with pikepdf.open(io.BytesIO(unlocked)):
        pass
except AssertionError as exc:
    failures.append(f"protect/unlock: {exc}")

try:
    pdf_meta = make_pdf_with_metadata(1, "Meta")
    resp = client.post(
        "/metadata/strip",
        files={"file": ("meta.pdf", pdf_meta, "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    stripped = resp.content
    with pikepdf.open(io.BytesIO(stripped)) as pdf:
        assert not pdf.docinfo, f"expected empty docinfo, got {pdf.docinfo}"
except AssertionError as exc:
    failures.append(f"metadata: {exc}")

try:
    pdf_mark = make_pdf(2, "Mark")
    resp = client.post(
        "/watermark/text",
        files={"file": ("mark.pdf", pdf_mark, "application/pdf")},
        data={"text": "CONFIDENTIAL", "opacity": "0.3", "rotation": "45", "font_size": "36"},
    )
    assert resp.status_code == 200, resp.text
    assert_pdf_page_count(resp.content, 2)
except AssertionError as exc:
    failures.append(f"watermark text: {exc}")

try:
    pdf_mark = make_pdf(1, "ImageMark")
    img = Image.new("RGB", (120, 120), color=(200, 0, 0))
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_bytes = img_buf.getvalue()
    resp = client.post(
        "/watermark/image",
        files={
            "pdf_file": ("img.pdf", pdf_mark, "application/pdf"),
            "image_file": ("logo.png", img_bytes, "image/png"),
        },
        data={"opacity": "0.4", "scale": "0.4"},
    )
    assert resp.status_code == 200, resp.text
    assert_pdf_page_count(resp.content, 1)
except AssertionError as exc:
    failures.append(f"watermark image: {exc}")

try:
    pdf_reorder = make_pdf(4, "Order")
    resp = client.post(
        "/reorder",
        files={"file": ("reorder.pdf", pdf_reorder, "application/pdf")},
        data={"order": "3,1-2,4"},
    )
    assert resp.status_code == 200, resp.text
    order_lines = read_first_lines(resp.content)
    assert order_lines == ["Order page 3", "Order page 1", "Order page 2", "Order page 4"], order_lines
except AssertionError as exc:
    failures.append(f"reorder: {exc}")

try:
    pdf_rotate = make_pdf(3, "Rotate")
    resp = client.post(
        "/rotate",
        files={"file": ("rotate.pdf", pdf_rotate, "application/pdf")},
        data={"ranges": "1-2", "degrees": "180"},
    )
    assert resp.status_code == 200, resp.text
    reader = PdfReader(io.BytesIO(resp.content))
    rotations = [page.get("/Rotate", 0) for page in reader.pages]
    assert rotations == [180, 180, 0], rotations
except AssertionError as exc:
    failures.append(f"rotate: {exc}")

try:
    pdf_highlight = make_pdf(1, "Highlight")
    payload = json.dumps([
        {"pageIndex": 0, "left": 0.1, "top": 0.2, "width": 0.4, "height": 0.08}
    ])
    resp = client.post(
        "/annotate/highlight",
        files={"file": ("highlight.pdf", pdf_highlight, "application/pdf")},
        data={"highlights": payload},
    )
    assert resp.status_code == 200, resp.text
    with pikepdf.open(io.BytesIO(resp.content)) as pdf:
        annotations = getattr(pdf.pages[0], "Annots", None)
        if annotations is None:
            annotations = pdf.pages[0].get("/Annots")
        assert annotations is not None and len(annotations) >= 1
except AssertionError as exc:
    failures.append(f"highlight annotate: {exc}")

if failures:
    print("FAIL")
    for item in failures:
        print(" -", item)
    raise SystemExit(1)
else:
    print("PASS: all smoke tests succeeded")
