import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from reportlab.lib.utils import ImageReader
from PIL import Image

def add_text_watermark_pdf_bytes(
    pdf_data: bytes,
    text: str,
    opacity: float = 0.3,
    rotation: int = 45,
    font_size: int = 50,
) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_data))
    writer = PdfWriter()

    for page in reader.pages:
        media_box = page.mediabox
        width = float(media_box.width)
        height = float(media_box.height)

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(width, height))
        c.setFillColor(Color(0.5, 0.5, 0.5, alpha=opacity))
        c.setFont("Helvetica", font_size)
        
        c.translate(width / 2, height / 2)
        c.rotate(rotation)
        c.drawCentredString(0, 0, text)
        
        c.save()
        packet.seek(0)

        overlay = PdfReader(packet).pages[0]
        page.merge_page(overlay)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

def add_image_watermark_pdf_bytes(
    pdf_data: bytes,
    image_data: bytes,
    opacity: float = 0.3,
    scale: float = 0.5,
) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_data))
    writer = PdfWriter()

    img = Image.open(io.BytesIO(image_data)).convert("RGBA")

    temp_img = img.copy()
    alpha_layer = Image.new("L", temp_img.size, int(255 * opacity))
    temp_img.putalpha(alpha_layer)
    img_buffer = io.BytesIO()
    temp_img.save(img_buffer, "PNG")
    watermark_bytes = img_buffer.getvalue()

    for page in reader.pages:
        media_box = page.mediabox
        page_width = float(media_box.width)
        page_height = float(media_box.height)

        img_width = page_width * scale
        img_height = img_width * (img.size[1] / img.size[0])
        if img_height > page_height:
            img_height = page_height
            img_width = img_height * (img.size[0] / img.size[1])

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(page_width, page_height))
        image_reader = ImageReader(io.BytesIO(watermark_bytes))
        c.drawImage(
            image_reader,
            (page_width - img_width) / 2,
            (page_height - img_height) / 2,
            width=img_width,
            height=img_height,
            mask="auto",
        )
        c.save()
        packet.seek(0)

        overlay = PdfReader(packet).pages[0]
        page.merge_page(overlay)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
