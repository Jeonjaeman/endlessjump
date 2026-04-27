"""Generate app icons for Endless Jump (무한의당근)"""
from PIL import Image, ImageDraw, ImageFont
import os

def draw_icon(size: int) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size  # shorthand
    c = s / 2  # center

    # Background - gradient-like sky blue circle
    d.ellipse([0, 0, s, s], fill='#4FC3F7')
    # Inner gradient effect
    d.ellipse([s*0.05, s*0.05, s*0.95, s*0.95], fill='#81D4FA')
    d.ellipse([s*0.12, s*0.08, s*0.88, s*0.75], fill='#B3E5FC')

    # Carrot body (center-bottom area)
    carrot_cx = c
    carrot_top = s * 0.52
    carrot_bot = s * 0.92
    carrot_w = s * 0.12
    d.polygon([
        (carrot_cx - carrot_w, carrot_top),
        (carrot_cx + carrot_w, carrot_top),
        (carrot_cx, carrot_bot),
    ], fill='#FF6B35')
    # Carrot highlight
    d.polygon([
        (carrot_cx - carrot_w * 0.3, carrot_top + s*0.02),
        (carrot_cx + carrot_w * 0.1, carrot_top + s*0.02),
        (carrot_cx - carrot_w * 0.1, carrot_bot - s*0.08),
    ], fill='#FF8F5E')
    # Carrot lines
    for i in range(1, 4):
        ly = carrot_top + (carrot_bot - carrot_top) * i * 0.22
        lw = carrot_w * (1 - i * 0.2)
        d.line([(carrot_cx - lw, ly), (carrot_cx + lw, ly)], fill='#E85520', width=max(1, int(s*0.01)))

    # Carrot leaves
    leaf_base_y = carrot_top - s * 0.01
    for angle_off, lw in [(-s*0.08, s*0.06), (0, s*0.07), (s*0.08, s*0.06)]:
        lx = carrot_cx + angle_off
        d.ellipse([
            lx - lw * 0.4, leaf_base_y - s * 0.12,
            lx + lw * 0.4, leaf_base_y + s * 0.02
        ], fill='#4CAF50')

    # Bunny body (sitting on top of carrot)
    bunny_cx = c
    bunny_cy = s * 0.38
    br = s * 0.18  # body radius

    # Body
    d.ellipse([bunny_cx - br, bunny_cy - br*0.8, bunny_cx + br, bunny_cy + br*1.1], fill='#FFFFFF')
    # Belly
    d.ellipse([bunny_cx - br*0.5, bunny_cy, bunny_cx + br*0.5, bunny_cy + br*0.8], fill='#F5F0F0')

    # Head
    head_cy = bunny_cy - br * 0.7
    hr = br * 0.7
    d.ellipse([bunny_cx - hr, head_cy - hr, bunny_cx + hr, head_cy + hr*0.8], fill='#FFFFFF')

    # Ears
    ear_w = br * 0.25
    ear_h = br * 0.9
    # Left ear
    d.ellipse([bunny_cx - br*0.45 - ear_w, head_cy - hr - ear_h,
               bunny_cx - br*0.45 + ear_w, head_cy - hr*0.2], fill='#FFFFFF')
    d.ellipse([bunny_cx - br*0.45 - ear_w*0.5, head_cy - hr - ear_h*0.85,
               bunny_cx - br*0.45 + ear_w*0.5, head_cy - hr*0.35], fill='#FFB8B8')
    # Right ear
    d.ellipse([bunny_cx + br*0.45 - ear_w, head_cy - hr - ear_h,
               bunny_cx + br*0.45 + ear_w, head_cy - hr*0.2], fill='#FFFFFF')
    d.ellipse([bunny_cx + br*0.45 - ear_w*0.5, head_cy - hr - ear_h*0.85,
               bunny_cx + br*0.45 + ear_w*0.5, head_cy - hr*0.35], fill='#FFB8B8')

    # Eyes
    eye_r = br * 0.15
    eye_y = head_cy - hr * 0.1
    # Left eye
    d.ellipse([bunny_cx - hr*0.4 - eye_r, eye_y - eye_r,
               bunny_cx - hr*0.4 + eye_r, eye_y + eye_r], fill='#1a1a1a')
    # Right eye
    d.ellipse([bunny_cx + hr*0.4 - eye_r, eye_y - eye_r,
               bunny_cx + hr*0.4 + eye_r, eye_y + eye_r], fill='#1a1a1a')
    # Eye highlights
    hl = eye_r * 0.45
    d.ellipse([bunny_cx - hr*0.4 - hl*0.5, eye_y - eye_r*0.6,
               bunny_cx - hr*0.4 + hl, eye_y - eye_r*0.1], fill='#FFFFFF')
    d.ellipse([bunny_cx + hr*0.4 - hl*0.5, eye_y - eye_r*0.6,
               bunny_cx + hr*0.4 + hl, eye_y - eye_r*0.1], fill='#FFFFFF')

    # Nose
    nose_y = head_cy + hr * 0.2
    nr = br * 0.08
    d.ellipse([bunny_cx - nr*1.5, nose_y - nr, bunny_cx + nr*1.5, nose_y + nr], fill='#FFB8B8')

    # Cheeks
    cheek_r = br * 0.12
    d.ellipse([bunny_cx - hr*0.6 - cheek_r, eye_y + br*0.15 - cheek_r,
               bunny_cx - hr*0.6 + cheek_r, eye_y + br*0.15 + cheek_r], fill='#FFD0D0')
    d.ellipse([bunny_cx + hr*0.6 - cheek_r, eye_y + br*0.15 - cheek_r,
               bunny_cx + hr*0.6 + cheek_r, eye_y + br*0.15 + cheek_r], fill='#FFD0D0')

    # Feet
    foot_w = br * 0.3
    foot_h = br * 0.15
    d.ellipse([bunny_cx - br*0.6, bunny_cy + br*0.8,
               bunny_cx - br*0.6 + foot_w*2, bunny_cy + br*0.8 + foot_h*2], fill='#F0ECEC')
    d.ellipse([bunny_cx + br*0.6 - foot_w*2, bunny_cy + br*0.8,
               bunny_cx + br*0.6, bunny_cy + br*0.8 + foot_h*2], fill='#F0ECEC')

    return img


def main():
    base = "D:/Work/game/BunnyHop/android/app/src/main/res"
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    for folder, size in sizes.items():
        path = os.path.join(base, folder)
        os.makedirs(path, exist_ok=True)

        icon = draw_icon(size)

        # Save as ic_launcher.png
        icon_rgb = Image.new('RGB', (size, size), '#4FC3F7')
        icon_rgb.paste(icon, mask=icon)
        icon_rgb.save(os.path.join(path, 'ic_launcher.png'))

        # Save foreground (with transparency)
        icon.save(os.path.join(path, 'ic_launcher_foreground.png'))

        # Save round version
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse([0, 0, size, size], fill=255)
        round_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        round_icon.paste(icon, mask=mask)
        round_rgb = Image.new('RGB', (size, size), '#4FC3F7')
        round_rgb.paste(round_icon, mask=round_icon)
        round_rgb.save(os.path.join(path, 'ic_launcher_round.png'))

        print(f"Generated {folder}: {size}x{size}")

    print("All icons generated!")


if __name__ == "__main__":
    main()
