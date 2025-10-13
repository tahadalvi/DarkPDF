import io
from typing import Optional

import pikepdf

def compress_pdf_bytes(pdf_bytes: bytes, quality: Optional[str] = None) -> bytes:
    """
    Compresses a PDF using pikepdf's optimize flag. A quality parameter is accepted
    for future extension but is unused currently. Returns the compressed PDF bytes.
    """
    in_stream = io.BytesIO(pdf_bytes)
    out_stream = io.BytesIO()
    with pikepdf.open(in_stream) as pdf:
        pdf.save(out_stream, optimize=True)
    return out_stream.getvalue()
