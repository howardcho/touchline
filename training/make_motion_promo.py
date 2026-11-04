#!/usr/bin/env python3
"""Build an alternate high-energy Touchline motion-graphics trailer."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json
import math
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'training/screenshots'
MUSIC = ROOT / 'training/audio/touchline-break.m4a'
WORK = Path('/tmp/touchline-motion-promo')
WORK.mkdir(parents=True, exist_ok=True)
OUT = ROOT / 'docs/assets/touchline-motion-promo.mp4'
POSTER = ROOT / 'docs/assets/touchline-motion-promo-poster.jpg'
VTT = ROOT / 'docs/assets/touchline-motion-promo.vtt'

W, H, FPS, TOTAL = 1920, 1080, 30, 76.0
INK, DEEP, PAPER = '#0b241c', '#143b30', '#f3f2e9'
LIME, ORANGE, MUTED = '#dff28d', '#e58d55', '#b9c8bd'
TEAM = ['#ef4b48', '#3e81f6', '#4ec46b', '#161d1a', '#f1cf35']


def run(*args):
    subprocess.run(args, check=True)


def font(size, bold=False, serif=False):
    choices = (
        ['/System/Library/Fonts/NewYork.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf']
        if serif else
        (['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
         if bold else ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'])
    )
    for choice in choices:
        if Path(choice).exists():
            return ImageFont.truetype(choice, size)
    return ImageFont.load_default()


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def smooth(value):
    value = clamp(value)
    return value * value * (3 - 2 * value)


def out_back(value):
    value = clamp(value)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2


def fit_crop(image, size, focus=(0.5, 0.5)):
    width, height = size
    scale = max(width / image.width, height / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    x = max(0, min(image.width - width, round(image.width * focus[0] - width / 2)))
    y = max(0, min(image.height - height, round(image.height * focus[1] - height / 2)))
    return image.crop((x, y, x + width, y + height))


def source_image(name):
    image = Image.open(SHOTS / f'{name}.png').convert('RGB')
    if name.startswith('settings'):
        image = image.crop((450, 5, 1470, 1075))
    elif name in {'timing', 'roster', 'summary', 'schedule', 'upcoming'}:
        image = image.crop((350, 0, 1570, 1080))
    return image


def make_card(name, width, height, radius=34):
    pad = 55
    result = Image.new('RGBA', (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', result.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((pad + 10, pad + 18, pad + width + 10, pad + height + 18), radius=radius, fill=(0, 0, 0, 135))
    result.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    image = fit_crop(source_image(name), (width, height))
    mask = Image.new('L', (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    result.paste(image, (pad, pad), mask)
    ImageDraw.Draw(result).rounded_rectangle((pad, pad, pad + width, pad + height), radius=radius, outline='#6f8d80', width=2)
    return result


def text_block(kicker, title, body, width=660, accent=LIME):
    result = Image.new('RGBA', (width, 580), (0, 0, 0, 0))
    draw = ImageDraw.Draw(result)
    draw.ellipse((0, 9, 14, 23), fill=accent)
    draw.text((32, 0), kicker, font=font(20, True), fill=accent)
    y = 74
    lines = title.split('\n')
    for index, line in enumerate(lines):
        draw.text((0, y), line, font=font(72, bold=index == 0, serif=index > 0), fill=PAPER)
        y += 84
    y += 28
    for line in textwrap.wrap(body, width=42):
        draw.text((0, y), line, font=font(27), fill=MUTED)
        y += 40
    draw.rounded_rectangle((0, y + 34, 245, y + 84), radius=25, fill=accent)
    draw.text((122, y + 59), 'TOUCHLINE', font=font(16, True), fill=INK, anchor='mm')
    return result.crop(result.getbbox())


cards = {
    'selection': make_card('selection', 1050, 650),
    'settings': make_card('settings-game', 820, 760),
    'board': make_card('board', 1120, 680),
    'clock': make_card('clock', 1560, 875),
    'audio': make_card('settings-audio', 800, 760),
    'upcoming': make_card('upcoming', 820, 650),
    'schedule': make_card('schedule', 720, 760),
    'timing': make_card('timing', 760, 660),
    'roster': make_card('roster', 760, 660),
    'summary': make_card('summary', 720, 760),
}

scenes = [
    dict(start=0.0, kind='hero', kicker='AGED ATHLETICS PRESENTS', title='TOUCHLINE', body='LESS ORGANIZING. MORE PLAYING.'),
    dict(start=5.5, kind='split', card='selection', kicker='START IN SECONDS', title='Pick teams.\nStart playing.', body='Balanced rotations for two through five teams.'),
    dict(start=12.5, kind='split', card='settings', reverse=True, kicker='MAKE IT YOURS', title='Your colors.\nYour clock.', body='Save the timing, colors, countdown, and finish rule for every team count.'),
    dict(start=20.0, kind='split', card='board', kicker='ONE CLEAR VIEW', title='Run the whole\ntouchline.', body='Now playing, up next, timing, and controls stay together.'),
    dict(start=27.5, kind='clock', card='clock', kicker='MAXIMIZED CLOCK', title='04:00', body='Readable across the field.'),
    dict(start=34.5, kind='audio', card='audio', kicker='HEAR THE MOMENT', title='Your music ducks.\nTouchline cuts through.', body='Listen to the real app audio.'),
    dict(start=50.5, kind='stack', cards=['upcoming', 'schedule'], kicker='YOUR NEXT MOVE', title='Jump to\nany game.', body='See the rotation. Tap the matchup. Keep playing.'),
    dict(start=57.5, kind='double', cards=['timing', 'roster'], kicker='PICKUP NEVER STAYS STILL', title='Change the plan.\nKeep the game.', body='Adjust the session. Add a team. Remove a team. No restart.'),
    dict(start=64.5, kind='double', cards=['schedule', 'summary'], kicker='FAIR FROM START TO FINISH', title='Every game counts.', body='Balanced rotations in play. A complete report at the final whistle.'),
    dict(start=70.5, kind='close', kicker='TOUCHLINE', title='LESS ORGANIZING.\nMORE PLAYING.', body='Join the Android test at AgedAthletics.com'),
]

blocks = {
    index: text_block(scene['kicker'], scene['title'], scene['body'], accent=ORANGE if scene['kind'] == 'audio' else LIME)
    for index, scene in enumerate(scenes) if scene['kind'] in {'split', 'audio', 'stack', 'double'}
}

logo = Image.open(ROOT / 'icon-512.png').convert('RGBA')


def background(time, accent=LIME):
    image = Image.new('RGBA', (W, H), INK)
    draw = ImageDraw.Draw(image)
    # Animated broadcast-style arcs and a moving light ribbon.
    drift = 34 * math.sin(time * 0.42)
    for index in range(6):
        inset = index * 118
        draw.arc((1090 + drift - inset / 3, -520 + inset, 2250 + drift - inset / 3, 640 + inset), 110, 325, fill='#245044', width=2)
    ribbon = int((time * 170) % (W + 600)) - 600
    draw.polygon([(ribbon, 0), (ribbon + 210, 0), (ribbon + 670, H), (ribbon + 460, H)], fill=(34, 80, 66, 36))
    draw.line((0, H - 58, W, H - 58), fill='#31584a', width=1)
    draw.text((66, H - 30), 'TOUCHLINE', font=font(15, True), fill='#738d81', anchor='lm')
    return image


def paste_layer(canvas, layer, center, progress=1.0, exit_progress=0.0, side=1, max_scale=1.0):
    enter = out_back(progress)
    leave = smooth(exit_progress)
    scale = max_scale * (0.82 + 0.18 * enter - 0.07 * leave)
    angle = side * (4.0 * (1 - clamp(progress)) + 2.0 * leave)
    opacity = round(255 * smooth(progress / 0.28) * (1 - leave))
    transformed = layer
    if abs(scale - 1) > 0.001:
        transformed = transformed.resize((max(1, round(layer.width * scale)), max(1, round(layer.height * scale))), Image.Resampling.LANCZOS)
    if abs(angle) > 0.08:
        transformed = transformed.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    if opacity < 255:
        transformed = transformed.copy()
        transformed.putalpha(transformed.getchannel('A').point(lambda value: value * opacity // 255))
    x = round(center[0] - transformed.width / 2 + side * (260 * (1 - smooth(progress)) + 160 * leave))
    y = round(center[1] - transformed.height / 2 + 40 * (1 - smooth(progress)) - 25 * leave)
    canvas.alpha_composite(transformed, (x, y))


def flag(draw, x, y, color, width, phase=0.0):
    wave = 10 * math.sin(phase)
    points = [(x, y), (x + width, y + wave), (x + width - 24, y + 62 + wave), (x, y + 62)]
    draw.polygon(points, fill=color)
    draw.line(points + [points[0]], fill='#6f8d80' if color == '#161d1a' else color, width=3, joint='curve')


def render_scene(index, local, global_time):
    scene = scenes[index]
    end = scenes[index + 1]['start'] if index + 1 < len(scenes) else TOTAL
    duration = end - scene['start']
    progress = clamp(local / 0.85)
    exit_progress = clamp((local - (duration - 0.65)) / 0.65)
    accent = ORANGE if scene['kind'] == 'audio' else LIME
    canvas = background(global_time, accent)
    draw = ImageDraw.Draw(canvas)

    # A fast team-color sweep gives every entrance a branded motion beat.
    sweep = smooth(clamp(local / 0.55))
    for number, color in enumerate(TEAM):
        width = int((W / len(TEAM) + 18) * sweep)
        x = int(number * W / len(TEAM) - 9)
        draw.rectangle((x, 0, x + width, 9), fill=color)

    kind = scene['kind']
    if kind in {'hero', 'close'}:
        p = out_back(progress)
        leave = smooth(exit_progress)
        icon_size = round((150 if kind == 'hero' else 128) * (0.65 + 0.35 * p))
        icon = logo.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        icon.putalpha(icon.getchannel('A').point(lambda value: value * round(255 * (1 - leave)) // 255))
        canvas.alpha_composite(icon, ((W - icon_size) // 2, 112 if kind == 'hero' else 95))
        draw.text((W // 2, 310), scene['kicker'], font=font(22, True), fill=LIME, anchor='mm')
        lines = scene['title'].split('\n')
        base_y = 475 if kind == 'hero' else 440
        for line_number, line in enumerate(lines):
            y = base_y + line_number * 112 + int(55 * (1 - smooth(clamp((local - line_number * 0.14) / 0.7))))
            fill = PAPER if line_number == 0 else LIME
            face = font(104 if kind == 'hero' else 88, bold=line_number == 0, serif=line_number > 0)
            draw.text((W // 2, y), line, font=face, fill=fill, anchor='mm')
        body_y = 665 if kind == 'hero' else 720
        draw.text((W // 2, body_y), scene['body'], font=font(27, True if kind == 'hero' else False), fill=MUTED, anchor='mm')
        if kind == 'hero':
            for number, color in enumerate(TEAM):
                x = 570 + number * 165 + int((number - 2) * 80 * (1 - smooth(clamp((local - 0.6) / 0.8))))
                flag(draw, x, 820, color, 120, global_time * 3 + number)
        else:
            draw.rounded_rectangle((680, 820, 1240, 892), radius=36, fill=LIME)
            draw.text((960, 856), 'JOIN THE CLOSED ANDROID TEST  ↗', font=font(19, True), fill=INK, anchor='mm')
        return canvas

    if kind == 'clock':
        paste_layer(canvas, cards['clock'], (W // 2, 595), progress, exit_progress, 1, 0.98)
        reveal = smooth(clamp((local - 0.35) / 0.65))
        draw.rounded_rectangle((74, 78, 512, 143), radius=32, fill=(11, 36, 28, round(235 * reveal)))
        draw.text((105, 110), scene['kicker'], font=font(18, True), fill=LIME, anchor='lm')
        # A crisp scale pulse lands once; the timer does not drift afterward.
        pulse = 1 + 0.04 * math.sin(clamp((local - 1.0) / 0.8) * math.pi) if 1.0 < local < 1.8 else 1
        timer_font = font(round(116 * pulse), True)
        draw.text((W - 118, 112), scene['title'], font=timer_font, fill=PAPER, anchor='rm')
        draw.text((W - 118, 190), scene['body'], font=font(25), fill=MUTED, anchor='rm')
        return canvas

    if kind == 'split':
        reverse = scene.get('reverse', False)
        block_center = (1455 if reverse else 380, 525)
        card_center = (585 if reverse else 1325, 565)
        paste_layer(canvas, cards[scene['card']], card_center, progress, exit_progress, -1 if reverse else 1, 0.96)
        paste_layer(canvas, blocks[index], block_center, clamp((local - 0.15) / 0.85), exit_progress, 1 if reverse else -1)
        return canvas

    if kind == 'audio':
        paste_layer(canvas, cards['audio'], (520, 575), progress, exit_progress, -1, 0.95)
        paste_layer(canvas, blocks[index], (1430, 420), clamp((local - 0.12) / 0.85), exit_progress, 1)
        # Live meter: the bed falls before the actual cues, then recovers.
        cue_times = [1.9, 5.3, 9.0, 10.8, 13.7]
        ducked = any(cue - 0.5 <= local <= cue + (2.8 if cue < 13 else 5.8) for cue in cue_times)
        meter = 0.24 if ducked else 0.9
        x0, y0, meter_w = 1080, 805, 670
        draw.text((x0, y0 - 42), 'MUSIC LEVEL', font=font(16, True), fill=MUTED)
        draw.rounded_rectangle((x0, y0, x0 + meter_w, y0 + 26), radius=13, fill='#284c40')
        draw.rounded_rectangle((x0, y0, x0 + int(meter_w * meter), y0 + 26), radius=13, fill=ORANGE if ducked else LIME)
        draw.text((x0 + meter_w, y0 + 64), 'DUCKS BEFORE THE CUE' if ducked else 'MUSIC RETURNS', font=font(15, True), fill=ORANGE if ducked else LIME, anchor='ra')
        for bar in range(26):
            amplitude = 12 + 34 * abs(math.sin(global_time * 4.4 + bar * 0.68))
            x = x0 + bar * 25
            draw.rounded_rectangle((x, 930 - amplitude, x + 10, 930 + amplitude), radius=5, fill='#7fa292')
        return canvas

    if kind == 'stack':
        paste_layer(canvas, cards['schedule'], (1370, 570), clamp((local - 0.18) / 0.9), exit_progress, 1, 0.78)
        paste_layer(canvas, cards['upcoming'], (1065, 575), progress, exit_progress, 1, 0.92)
        paste_layer(canvas, blocks[index], (360, 490), clamp((local - 0.1) / 0.85), exit_progress, -1)
        return canvas

    if kind == 'double':
        first, second = scene['cards']
        paste_layer(canvas, cards[first], (1135, 590), progress, exit_progress, 1, 0.82)
        paste_layer(canvas, cards[second], (1525, 590), clamp((local - 0.18) / 0.85), exit_progress, 1, 0.82)
        paste_layer(canvas, blocks[index], (365, 470), clamp((local - 0.08) / 0.85), exit_progress, -1)
        if index == 8:
            # Report-style numbers land after the cards settle.
            count = round(7 * smooth(clamp((local - 1.4) / 1.1)))
            draw.text((420, 855), f'{count}', font=font(82, True), fill=LIME, anchor='mm')
            draw.text((420, 930), 'GAMES EACH', font=font(16, True), fill=MUTED, anchor='mm')
        return canvas
    return canvas


def scene_index(time):
    for index in range(len(scenes) - 1, -1, -1):
        if time >= scenes[index]['start']:
            return index
    return 0


video_only = WORK / 'video-only.mp4'
encoder = subprocess.Popen([
    'ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
    '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(video_only)
], stdin=subprocess.PIPE)

for frame_number in range(round(TOTAL * FPS)):
    time = frame_number / FPS
    index = scene_index(time)
    local = time - scenes[index]['start']
    frame = render_scene(index, local, time)
    # A short luminous flash bridges scenes without obscuring the UI during holds.
    if local < 0.16 and index > 0:
        strength = round(105 * (1 - local / 0.16))
        flash = Image.new('RGBA', (W, H), (223, 242, 141, strength))
        frame = Image.alpha_composite(frame, flash)
    encoder.stdin.write(frame.tobytes())
encoder.stdin.close()
if encoder.wait() != 0:
    raise SystemExit('Video encoder failed')


def duck_expression(windows, low=0.17, ramp=0.5):
    expression = '1'
    for start, end in reversed(windows):
        down, up = start - ramp, end + ramp
        expression = (
            f'if(between(t,{down:.2f},{start:.2f}),1-(t-{down:.2f})*{(1-low)/ramp:.3f},'
            f'if(between(t,{start:.2f},{end:.2f}),{low},'
            f'if(between(t,{end:.2f},{up:.2f}),{low}+(t-{end:.2f})*{(1-low)/ramp:.3f},{expression})))'
        )
    return expression


ducks = [(36.4, 37.8), (39.8, 42.0), (43.5, 54.0)]
bed = duck_expression(ducks)
audio_sources = [
    MUSIC,
    ROOT / 'audio/referee.mp3',
    ROOT / 'audio/minute.mp3',
    ROOT / 'audio/ten.mp3',
    ROOT / 'audio/callouts/deck-red-black.mp3',
    ROOT / 'audio/referee.mp3', ROOT / 'audio/referee.mp3', ROOT / 'audio/referee.mp3',
    ROOT / 'audio/crowd.mp3',
]
mix = [
    f"[1:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,volume='0.94*({bed})':eval=frame,afade=t=in:st=0:d=0.8,afade=t=out:st=72.5:d=3.5[bed]",
    '[2:a]atrim=0:1.25,asetpts=PTS-STARTPTS,afade=t=out:st=1.18:d=0.07,adelay=36400:all=1[kickoff]',
    '[3:a]adelay=39800:all=1[minute]',
    '[4:a]adelay=43500:all=1[ten]',
    '[5:a]adelay=45800:all=1[deck]',
    '[6:a]atrim=0:0.4,asetpts=PTS-STARTPTS,afade=t=out:st=0.36:d=0.04,adelay=49200:all=1[w1]',
    '[7:a]atrim=0:0.45,asetpts=PTS-STARTPTS,afade=t=out:st=0.41:d=0.04,adelay=50050:all=1[w2]',
    '[8:a]atrim=0:1.6,asetpts=PTS-STARTPTS,afade=t=out:st=1.54:d=0.06,adelay=50950:all=1[w3]',
    '[9:a]volume=0.28,afade=t=out:st=5.7:d=0.3,adelay=52550:all=1[crowd]',
    '[bed][kickoff][minute][ten][deck][w1][w2][w3][crowd]amix=inputs=9:duration=longest:normalize=0,alimiter=limit=0.95:attack=5:release=80[mix]'
]
command = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(video_only)]
for source in audio_sources:
    command += ['-i', str(source)]
command += ['-filter_complex', ';'.join(mix), '-map', '0:v', '-map', '[mix]', '-t', str(TOTAL),
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', str(OUT)]
run(*command)

poster = render_scene(0, 2.2, 2.2).convert('RGB')
poster.save(POSTER, quality=92, optimize=True)
VTT.write_text("""WEBVTT

00:00:00.000 --> 00:00:36.300
[Energetic instrumental music]

00:00:36.400 --> 00:00:37.700
[Referee kickoff whistle]

00:00:39.800 --> 00:00:41.400
One minute remaining.

00:00:43.500 --> 00:00:45.500
Ten seconds remaining.

00:00:45.800 --> 00:00:48.400
Team red and team black, you're on deck!

00:00:49.200 --> 00:00:52.550
[Three referee whistles]

00:00:52.550 --> 00:00:58.550
[Stadium crowd roars]

00:00:58.550 --> 00:01:16.000
[Energetic instrumental music]
""")

probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', str(OUT)
], text=True))['format']
print(json.dumps({'video': str(OUT), 'poster': str(POSTER), **probe}))
