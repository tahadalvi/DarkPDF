# DarkPDF

A full-stack PDF manipulation toolkit with a dark-themed UI. Merge, split, protect, watermark, compress, and annotate PDFs with ease.

## Features

- **Merge** - Combine multiple PDFs into one
- **Split** - Extract pages into separate files
- **Reorder** - Rearrange pages in custom order
- **Rotate** - Rotate pages by 90°, 180°, or 270°
- **Protect** - Add password encryption
- **Unlock** - Remove password protection
- **Watermark** - Add text or image watermarks
- **Compress** - Optimize PDF file size
- **Edit** - Replace text while preserving fonts
- **Highlight** - Add annotations to PDFs
- **Strip Metadata** - Remove document metadata for privacy

---

## Installation Options

### Option 1: Docker (Recommended for Development)

**Prerequisites:** Docker and Docker Compose

```bash
docker compose up --build
```

- API: http://localhost:8000
- Web UI: http://localhost:3000

---

### Option 2: Windows Desktop App

Download and run the installer for a standalone desktop experience. No Docker required!

#### Pre-built Installer

Download `DarkPDF-Setup.exe` from the [Releases](releases) page and run it.

#### Build from Source

**Prerequisites:**
- Python 3.10+ ([Download](https://www.python.org/downloads/))
- Node.js 18+ ([Download](https://nodejs.org/))
- Git

**Steps:**

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DarkPDF.git
   cd DarkPDF
   ```

2. Run the build script:
   ```batch
   scripts\build-windows.bat
   ```

   Or with PowerShell:
   ```powershell
   scripts\build-windows.ps1
   ```

3. Find the installer at `desktop\dist\DarkPDF Setup.exe`

---

### Option 3: Local Development (Without Docker)

Run the API and web server directly on your machine.

**Prerequisites:**
- Python 3.10+
- Node.js 18+

**Quick Start (Windows):**

```batch
scripts\dev-local.bat
```

Or with PowerShell:
```powershell
scripts\dev-local.ps1
```

**Manual Start:**

1. **Start the API server:**
   ```bash
   cd api
   pip install -r requirements.txt
   python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Start the web server** (in another terminal):
   ```bash
   cd web
   npm install
   set NEXT_PUBLIC_API_URL=http://localhost:8000
   npm run dev
   ```

3. Open http://localhost:3000 in your browser.

---

## Project Structure

```
DarkPDF/
├── api/                    # FastAPI backend
│   ├── app.py             # Main API endpoints
│   ├── security.py        # Encryption utilities
│   ├── watermark.py       # Watermarking functions
│   ├── compression.py     # PDF compression
│   ├── editing.py         # Text editing
│   └── requirements.txt   # Python dependencies
│
├── web/                    # Next.js frontend
│   ├── pages/             # React pages
│   └── package.json       # Node dependencies
│
├── desktop/               # Electron desktop wrapper
│   ├── main.js           # Electron main process
│   └── package.json      # Electron config
│
├── scripts/               # Build and dev scripts
│   ├── build-windows.bat # Windows build script
│   ├── build-windows.ps1 # PowerShell build script
│   ├── dev-local.bat     # Local dev script
│   └── generate-icons.py # Icon generator
│
└── docker-compose.yml     # Docker configuration
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/merge` | Merge multiple PDFs |
| POST | `/split` | Split PDF into parts |
| POST | `/protect` | Password protect PDF |
| POST | `/unlock` | Remove password |
| POST | `/metadata/strip` | Remove metadata |
| POST | `/watermark/text` | Add text watermark |
| POST | `/watermark/image` | Add image watermark |
| POST | `/reorder` | Reorder pages |
| POST | `/rotate` | Rotate pages |
| POST | `/compress` | Compress PDF |
| POST | `/edit/replace_text` | Replace text |
| POST | `/annotate/highlight` | Add highlights |

---

## Tech Stack

**Backend:**
- FastAPI + Uvicorn
- pypdf, pikepdf, pymupdf, reportlab
- Pillow for image processing

**Frontend:**
- Next.js 14 + React 18
- Chakra UI
- PDF.js for viewing

**Desktop:**
- Electron
- electron-builder for packaging

---

## License

MIT
