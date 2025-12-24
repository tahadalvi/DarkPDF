# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for DarkPDF API
Bundles the FastAPI backend into a single Windows executable
"""

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all submodules for complex packages
hiddenimports = [
    # FastAPI and dependencies
    'fastapi',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',

    # Starlette (FastAPI dependency)
    'starlette',
    'starlette.routing',
    'starlette.responses',
    'starlette.requests',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.formparsers',

    # Pydantic
    'pydantic',
    'pydantic_core',

    # PDF libraries
    'pypdf',
    'pikepdf',
    'pikepdf._qpdf',
    'pymupdf',
    'fitz',
    'reportlab',
    'reportlab.lib',
    'reportlab.lib.colors',
    'reportlab.lib.pagesizes',
    'reportlab.lib.units',
    'reportlab.pdfgen',
    'reportlab.pdfgen.canvas',
    'reportlab.pdfbase',
    'reportlab.pdfbase.pdfmetrics',
    'reportlab.pdfbase.ttfonts',
    'reportlab.graphics',

    # Image processing
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',

    # Multipart form data
    'multipart',
    'python_multipart',

    # Standard library that might be missed
    'email.mime.multipart',
    'email.mime.text',
    'email.mime.base',
    'encodings',
    'codecs',
]

# Collect data files for reportlab (fonts, etc.)
datas = []
datas += collect_data_files('reportlab')

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'pandas',
        'pytest',
        'IPython',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='api',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for logging, can be set to False for production
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../desktop/assets/icon.ico',
)
