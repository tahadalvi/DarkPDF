import io
from pikepdf import Pdf, Encryption

def encrypt_pdf_bytes(data: bytes, password: str) -> bytes:
    with Pdf.open(io.BytesIO(data)) as pdf:
        out = io.BytesIO()
        pdf.save(out, encryption=Encryption(
            user=password,
            owner=password,
            R=6,
        ))
        return out.getvalue()

def unlock_pdf_bytes(data: bytes, password: str) -> bytes:
    with Pdf.open(io.BytesIO(data), password=password) as pdf:
        out = io.BytesIO()
        pdf.save(out)
        return out.getvalue()

def strip_metadata_pdf_bytes(data: bytes) -> bytes:
    with Pdf.open(io.BytesIO(data)) as pdf:
        for key in list(pdf.docinfo.keys()):
            del pdf.docinfo[key]
        try:
            with pdf.open_metadata(set_pikepdf_as_editor=False) as metadata:
                metadata.clear()
        except (AttributeError, TypeError, ValueError):
            pass
        out = io.BytesIO()
        pdf.save(out)
        return out.getvalue()
