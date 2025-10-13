import io
import re
from typing import Optional

import fitz  # PyMuPDF


def _find_span(doc: fitz.Document, page_index: int, find_text: str):
    """
    Walks a document to find the first span containing the specified text.
    Returns a tuple of (page, span, line) or (None, None, None) if not found.
    """
    page = doc[page_index]
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if find_text in span.get("text", ""):
                    return page, span, line
    return None, None, None


def replace_text_preserving_style(
    pdf_bytes: bytes,
    page_index: int,
    find_text: str,
    replace_text: str,
    fallback_font_bytes: Optional[bytes] = None,
) -> bytes:
    """
    Replaces the first occurrence of `find_text` on the specified page with `replace_text`,
    attempting to reuse the existing font family, size and color. If the embedded font
    cannot be reused (e.g. subset fonts), an optional fallback font can be provided
    to embed and use instead.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page, span, line = _find_span(doc, page_index, find_text)
    if span is None:
        raise ValueError("Target text not found on the specified page.")

    # Extract style information
    font_name = span.get("font", "")
    font_size = float(span.get("size", 12.0))
    color = span.get("color", 0)
    bbox = span.get("bbox", None)
    if not bbox:
        raise ValueError("Could not determine span bounding box.")
    x0, y0, x1, y1 = bbox

    # Cover the original text with a white rectangle
    page.draw_rect(fitz.Rect(x0, y0, x1, y1), color=(1, 1, 1), fill=(1, 1, 1))

    # Determine font to use
    base14 = {
        "Times-Roman": "tiro",
        "Times New Roman": "tiro",
        "Helvetica": "helv",
        "Arial": "helv",
        "Courier": "cour",
    }
    clean_name = re.sub(r"^[A-Z]{6}\+", "", font_name or "")
    if clean_name in base14:
        font_ref_name = base14[clean_name]
    else:
        if fallback_font_bytes:
            doc.insert_font(name="matchfont", file=io.BytesIO(fallback_font_bytes))
            font_ref_name = "matchfont"
        else:
            font_ref_name = "helv"

    # Convert integer RGB color to normalized tuple
    r = ((color >> 16) & 255) / 255.0
    g = ((color >> 8) & 255) / 255.0
    b = (color & 255) / 255.0

    # Approximate baseline alignment for new text
    baseline_y = y1 - (0.2 * font_size)

    page.insert_text(
        fitz.Point(x0, baseline_y),
        replace_text,
        fontname=font_ref_name,
        fontsize=font_size,
        color=(r, g, b),
    )

    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()
