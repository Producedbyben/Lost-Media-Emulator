#!/usr/bin/env python3
"""Generate a CRT/retro-screen app icon for Build Together (1024px master)."""
import math
from PIL import Image, ImageDraw, ImageFilter

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def squircle_mask(size, radius_ratio=0.225):
    """macOS-style rounded-rect (continuous corner) mask."""
    m = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(m)
    r = int(size * radius_ratio)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return m


# --- Background: deep indigo -> near-black vertical gradient ---
bg = Image.new("RGBA", (S, S))
top = (28, 24, 54)
bot = (8, 8, 12)
for y in range(S):
    t = y / S
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    ImageDraw.Draw(bg).line([(0, y), (S, y)], fill=(r, g, b, 255))

# --- CRT screen panel ---
pad = int(S * 0.17)
screen = [pad, pad + int(S * 0.02), S - pad, S - pad - int(S * 0.02)]
sd = ImageDraw.Draw(bg)
# subtle phosphor glow behind screen
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.rounded_rectangle(screen, radius=int(S * 0.06), fill=(80, 120, 255, 120))
glow = glow.filter(ImageFilter.GaussianBlur(48))
bg = Image.alpha_composite(bg, glow)
sd = ImageDraw.Draw(bg)
# screen body
sd.rounded_rectangle(screen, radius=int(S * 0.06), fill=(12, 14, 22, 255))

# --- Scanlines ---
sl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sld = ImageDraw.Draw(sl)
step = 14
for y in range(screen[1], screen[3], step):
    sld.line([(screen[0], y), (screen[2], y)], fill=(255, 255, 255, 16), width=4)
# clip scanlines to screen
clip = Image.new("L", (S, S), 0)
ImageDraw.Draw(clip).rounded_rectangle(screen, radius=int(S * 0.06), fill=255)
sl.putalpha(Image.composite(sl.getchannel("A"), Image.new("L", (S, S), 0), clip))
bg = Image.alpha_composite(bg, sl)

# --- RGB phosphor "signal" bars (chromatic), the brand mark ---
sd = ImageDraw.Draw(bg)
cx0, cx1 = screen[0] + int(S * 0.07), screen[2] - int(S * 0.07)
midy = (screen[1] + screen[3]) // 2
amp = int(S * 0.085)
barw = int(S * 0.022)


def wave(color, phase, offy):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    pts = []
    for x in range(cx0, cx1, 6):
        t = (x - cx0) / (cx1 - cx0)
        y = midy + offy + int(math.sin(t * math.pi * 2.2 + phase) * amp)
        pts.append((x, y))
    ld.line(pts, fill=color, width=barw, joint="curve")
    return layer.filter(ImageFilter.GaussianBlur(2))


bg = Image.alpha_composite(bg, wave((255, 60, 80, 230), 0.0, -10))      # R
bg = Image.alpha_composite(bg, wave((60, 255, 140, 230), 0.5, 0))       # G
bg = Image.alpha_composite(bg, wave((70, 130, 255, 230), 1.0, 10))      # B

# re-clip waves to the screen rounded rect
clipped = Image.new("RGBA", (S, S), (0, 0, 0, 0))
clipped.paste(bg, (0, 0))
final_bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
final_bg.paste(bg, (0, 0))

# --- Vignette on screen ---
vig = Image.new("L", (S, S), 0)
vd = ImageDraw.Draw(vig)
vd.rounded_rectangle(screen, radius=int(S * 0.06), fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(60))
dark = Image.new("RGBA", (S, S), (0, 0, 0, 90))
final_bg = Image.alpha_composite(final_bg, Image.composite(Image.new("RGBA", (S, S), (0, 0, 0, 0)), dark, vig))

# Apply outer squircle mask
mask = squircle_mask(S)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(final_bg, (0, 0), mask)

img.save("build/icon_1024.png")
print("wrote build/icon_1024.png")
