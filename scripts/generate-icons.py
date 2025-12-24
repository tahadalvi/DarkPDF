#!/usr/bin/env python3
"""
Icon Generator for DarkPDF

This script generates all necessary icon files for the desktop application.
Requires: Pillow (pip install pillow)

Usage:
    python generate-icons.py
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: Pillow is required. Install with: pip install pillow")
    sys.exit(1)


def create_icon_image(size):
    """Create a DarkPDF icon at the specified size."""
    # Create image with dark background
    img = Image.new('RGBA', (size, size), (13, 16, 23, 255))
    draw = ImageDraw.Draw(img)

    # Calculate scaling
    scale = size / 256

    # Draw rounded rectangle background (simplified as full rect)
    margin = int(20 * scale)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(24 * scale),
        fill=(26, 31, 46, 255)
    )

    # Draw document shape
    doc_left = int(70 * scale)
    doc_top = int(50 * scale)
    doc_right = int(190 * scale)
    doc_bottom = int(210 * scale)
    fold_size = int(30 * scale)

    # Document polygon points
    doc_points = [
        (doc_left, doc_top),
        (doc_right - fold_size, doc_top),
        (doc_right, doc_top + fold_size),
        (doc_right, doc_bottom),
        (doc_left, doc_bottom),
    ]
    draw.polygon(doc_points, fill=(30, 41, 59, 255))

    # Folded corner
    fold_points = [
        (doc_right - fold_size, doc_top),
        (doc_right - fold_size, doc_top + fold_size),
        (doc_right, doc_top + fold_size),
    ]
    draw.polygon(fold_points, fill=(15, 23, 42, 255))

    # Draw teal accent border on document
    teal = (20, 184, 166, 255)
    draw.line(doc_points + [doc_points[0]], fill=teal, width=max(1, int(2 * scale)))

    # Text lines (simplified)
    line_left = int(90 * scale)
    line_y_start = int(100 * scale)
    line_height = int(20 * scale)
    line_widths = [80, 60, 70, 50]

    for i, width in enumerate(line_widths):
        y = line_y_start + i * line_height
        opacity = int(255 * (0.8 - i * 0.15))
        line_color = (20, 184, 166, opacity)
        draw.rounded_rectangle(
            [line_left, y, line_left + int(width * scale), y + int(6 * scale)],
            radius=int(3 * scale),
            fill=line_color
        )

    return img


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    assets_dir = os.path.join(project_root, 'desktop', 'assets')

    os.makedirs(assets_dir, exist_ok=True)

    print("Generating DarkPDF icons...")

    # Generate PNG icons at various sizes
    sizes = [16, 32, 48, 64, 128, 256, 512]
    png_images = {}

    for size in sizes:
        img = create_icon_image(size)
        png_path = os.path.join(assets_dir, f'icon-{size}.png')
        img.save(png_path, 'PNG')
        png_images[size] = img
        print(f"  Created: icon-{size}.png")

    # Save main icon.png (256x256)
    main_png_path = os.path.join(assets_dir, 'icon.png')
    png_images[256].save(main_png_path, 'PNG')
    print(f"  Created: icon.png")

    # Generate Windows .ico file (contains multiple sizes)
    ico_path = os.path.join(assets_dir, 'icon.ico')
    ico_sizes = [16, 32, 48, 256]
    ico_images = [png_images[s] for s in ico_sizes]

    # Save as ICO
    ico_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )
    print(f"  Created: icon.ico")

    # Generate macOS .icns would require additional tools
    # For now, just note that icon.png can be used

    print("")
    print("Icon generation complete!")
    print(f"Icons saved to: {assets_dir}")


if __name__ == '__main__':
    main()
