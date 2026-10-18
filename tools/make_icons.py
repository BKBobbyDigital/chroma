"""Draws the CHROMA app icon (molten elbow pipe on black steel) at the sizes a PWA needs.

Usage: python3 tools/make_icons.py icons
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
S = 1024


def path_points(scale):
    """Points along the elbow: up the left, a quarter bend, then right."""
    c = S / 2
    def t(x, y):
        return (c + (x - c) * scale, c + (y - c) * scale)
    pts = []
    for i in range(60):
        pts.append(t(360, 840 - i * (300 / 60)))
    for i in range(91):
        a = math.radians(180 + i)
        pts.append(t(560 + math.cos(a) * 200, 540 + math.sin(a) * 200))
    for i in range(60):
        pts.append(t(560 + i * (300 / 60), 340))
    return pts


def stroke(img, pts, width, color):
    d = ImageDraw.Draw(img)
    r = width / 2
    for x, y in pts:
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def collar(img, center, horizontal, scale, color, edge):
    d = ImageDraw.Draw(img)
    x, y = center
    w, h = (60 * scale, 250 * scale) if horizontal else (250 * scale, 60 * scale)
    d.rounded_rectangle((x - w / 2, y - h / 2, x + w / 2, y + h / 2), radius=14 * scale, fill=edge)
    d.rounded_rectangle((x - w / 2 + 8, y - h / 2 + 8, x + w / 2 - 8, y + h / 2 - 8), radius=10 * scale, fill=color)


def icon(scale):
    img = Image.new('RGBA', (S, S), (8, 9, 11, 255))
    # brushed dark steel with a warm glow from the pipe
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((140, 140, 884, 884), fill=(255, 60, 15, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(160)))
    lines = ImageDraw.Draw(img)
    for i in range(0, S, 6):
        lines.line((0, i, S, i), fill=(255, 255, 255, 6))

    pts = path_points(scale)
    halo = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    stroke(halo, pts, 300 * scale, (255, 58, 10, 200))
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(50)))

    pipe = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    stroke(pipe, pts, 190 * scale, (60, 8, 2, 255))     # crust
    stroke(pipe, pts, 165 * scale, (168, 24, 10, 255))  # deep
    stroke(pipe, pts, 125 * scale, (255, 70, 20, 255))  # body
    shifted = [(x - 10 * scale, y - 10 * scale) for x, y in pts]
    stroke(pipe, shifted, 62 * scale, (255, 150, 64, 255))   # hot
    stroke(pipe, shifted, 20 * scale, (255, 230, 194, 255))  # core
    edge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    stroke(edge, pts, 190 * scale, (60, 8, 2, 255))
    img.alpha_composite(edge)
    img.alpha_composite(pipe.filter(ImageFilter.GaussianBlur(9 * scale)))

    c = S / 2
    def t(x, y):
        return (c + (x - c) * scale, c + (y - c) * scale)
    collar(img, t(360, 800), False, scale, (64, 26, 16, 255), (22, 5, 2, 255))
    collar(img, t(820, 340), True, scale, (64, 26, 16, 255), (22, 5, 2, 255))
    return img


os.makedirs(OUT, exist_ok=True)
full = icon(1.0)
safe = icon(0.8)  # maskable icons get cropped to a circle, so keep the emblem inside the safe zone
for size in (192, 512):
    full.resize((size, size), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, f'icon-{size}.png'))
    safe.resize((size, size), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, f'icon-maskable-{size}.png'))
safe.resize((180, 180), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
full.resize((32, 32), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'favicon-32.png'))
print('ok')
