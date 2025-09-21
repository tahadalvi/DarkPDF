from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os, io, zipfile, uuid, json
from utils import safe_tempfile, parse_page_ranges
from security import encrypt_pdf_bytes, unlock_pdf_bytes, strip_metadata_pdf_bytes
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, FloatObject, DictionaryObject, NameObject
from watermark import add_text_watermark_pdf_bytes, add_image_watermark_pdf_bytes

app = FastAPI(title="LightPDF-style API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    if not files or len(files) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two PDFs to merge.")

    writer = PdfWriter()
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"'{f.filename}' is not a PDF")
        data = await f.read()
        try:
            reader = PdfReader(io.BytesIO(data))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read {f.filename}: {e}")
        for page in reader.pages:
            writer.add_page(page)

    out_bytes = io.BytesIO()
    writer.write(out_bytes)
    out_bytes.seek(0)
    return StreamingResponse(out_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=merged-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/split")
async def split_pdf(file: UploadFile = File(...), ranges: str = Form("1-")):
    # ranges example: "1-3,5,7-9" or "2-" (from page 2 to end)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    data = await file.read()
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    spans = parse_page_ranges(ranges, len(reader.pages))
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for idx, (start, end) in enumerate(spans, start=1):
            w = PdfWriter()
            for i in range(start - 1, end):
                w.add_page(reader.pages[i])
            out = io.BytesIO()
            w.write(out); out.seek(0)
            zf.writestr(f"split_{idx}_{start}-{end}.pdf", out.getvalue())
    mem_zip.seek(0)

    return StreamingResponse(mem_zip, media_type="application/zip", headers={
        "Content-Disposition": f"attachment; filename=split-{uuid.uuid4().hex[:8]}.zip"
    })

@app.post("/protect")
async def protect_pdf(file: UploadFile = File(...), password: str = Form(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    try:
        out_bytes = encrypt_pdf_bytes(data, password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Encrypt failed: {e}")

    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=protected-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/unlock")
async def unlock_pdf(file: UploadFile = File(...), password: str = Form(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    try:
        out_bytes = unlock_pdf_bytes(data, password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unlock failed: {e}")

    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=unlocked-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/metadata/strip")
async def strip_metadata(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    try:
        out_bytes = strip_metadata_pdf_bytes(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Metadata strip failed: {e}")

    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=scrubbed-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/watermark/text")
async def watermark_text_pdf(
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: float = Form(0.3),  # 0.0-1.0
    rotation: int = Form(45),    # degrees
    font_size: int = Form(50)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    try:
        out_bytes = add_text_watermark_pdf_bytes(
            data, text, opacity=opacity, rotation=rotation, font_size=font_size
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Watermark failed: {e}")

    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=watermarked-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/watermark/image")
async def watermark_image_pdf(
    pdf_file: UploadFile = File(...),
    image_file: UploadFile = File(...),
    opacity: float = Form(0.3),  # 0.0-1.0
    scale: float = Form(0.5)     # relative to page size
):
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF file must be a PDF")
    if not image_file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Image must be PNG or JPEG")
    
    pdf_data = await pdf_file.read()
    image_data = await image_file.read()
    try:
        out_bytes = add_image_watermark_pdf_bytes(
            pdf_data, image_data, opacity=opacity, scale=scale
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Watermark failed: {e}")

    return StreamingResponse(io.BytesIO(out_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=watermarked-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/reorder")
async def reorder_pages_pdf(
    file: UploadFile = File(...),
    order: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    spans = parse_page_ranges(order, len(reader.pages))
    writer = PdfWriter()
    for start, end in spans:
        for i in range(start - 1, end):
            writer.add_page(reader.pages[i])

    out_bytes = io.BytesIO()
    writer.write(out_bytes)
    out_bytes.seek(0)
    return StreamingResponse(out_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=reordered-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/rotate")
async def rotate_pages_pdf(
    file: UploadFile = File(...),
    ranges: str = Form("1-"),
    degrees: int = Form(90)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    if degrees not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Degrees must be 90, 180, or 270")
    
    data = await file.read()
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    spans = parse_page_ranges(ranges, len(reader.pages))
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if any(start - 1 <= i <= end - 1 for start, end in spans):
            page.rotate(degrees)
        writer.add_page(page)

    out_bytes = io.BytesIO()
    writer.write(out_bytes)
    out_bytes.seek(0)
    return StreamingResponse(out_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=rotated-{uuid.uuid4().hex[:8]}.pdf"
    })

@app.post("/annotate/highlight")
async def highlight_pdf(
    file: UploadFile = File(...),
    highlights: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        highlight_items = json.loads(highlights or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid highlight payload: {exc}")

    if not isinstance(highlight_items, list):
        raise HTTPException(status_code=400, detail="Highlights must be a list")

    data = await file.read()
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {exc}")

    writer = PdfWriter()
    for idx, page in enumerate(reader.pages):
        page_highlights = [item for item in highlight_items if int(item.get("pageIndex", -1)) == idx]
        if page_highlights:
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)
            for item in page_highlights:
                try:
                    left = float(item["left"])
                    top = float(item["top"])
                    width = float(item["width"])
                    height = float(item["height"])
                except (KeyError, ValueError, TypeError):
                    continue
                if width <= 0 or height <= 0:
                    continue
                x1 = max(left, 0.0) * page_width
                x2 = min(left + width, 1.0) * page_width
                y2 = (1.0 - max(min(top, 1.0), 0.0)) * page_height
                y1 = (1.0 - max(min(top + height, 1.0), 0.0)) * page_height
                if x2 <= x1 or y2 <= y1:
                    continue
                quad_points = ArrayObject([
                    FloatObject(x1), FloatObject(y2),
                    FloatObject(x2), FloatObject(y2),
                    FloatObject(x1), FloatObject(y1),
                    FloatObject(x2), FloatObject(y1),
                ])
                annotation = DictionaryObject({
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Highlight"),
                    NameObject("/Rect"): ArrayObject([FloatObject(x1), FloatObject(y1), FloatObject(x2), FloatObject(y2)]),
                    NameObject("/QuadPoints"): quad_points,
                    NameObject("/C"): ArrayObject([FloatObject(1), FloatObject(1), FloatObject(0)]),
                    NameObject("/CA"): FloatObject(0.65),
                })
                annotations_array = page.get(NameObject("/Annots"))
                if annotations_array is None:
                    annotations_array = ArrayObject()
                    page[NameObject("/Annots")] = annotations_array
                annotation_ref = writer._add_object(annotation)
                annotations_array.append(annotation_ref)
        writer.add_page(page)

    out_bytes = io.BytesIO()
    writer.write(out_bytes)
    out_bytes.seek(0)

    return StreamingResponse(
        out_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=highlighted-{uuid.uuid4().hex[:8]}.pdf"
        },
    )




