#!/usr/bin/env python3
"""Build Touchline's music-led website video with real in-app audio cues."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json
import shutil
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/tmp/touchline-training')
FRAMES = WORK / 'motion-frames'
CLIPS = WORK / 'motion-clips'
for path in (FRAMES, CLIPS):
    path.mkdir(parents=True, exist_ok=True)

SHOTS = ROOT / 'training/screenshots'
MUSIC = ROOT / 'training/audio/touchline-break.m4a'
OUT = ROOT / 'docs/assets/touchline-training.mp4'
POSTER = ROOT / 'docs/assets/touchline-training-poster.jpg'
VTT = ROOT / 'docs/assets/touchline-training.vtt'
W, H, FPS = 1920, 1080, 30
TOTAL = 123.12

INK = '#10251f'
PANEL = '#17372d'
PAPER = '#f3f2e9'
LIME = '#dff28d'
MUTED = '#b8c4b7'
ORANGE = '#e58d55'


def run(*args):
    subprocess.run(args, check=True)


def font(size, bold=False, serif=False):
    choices = (
        ['/System/Library/Fonts/NewYork.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf']
        if serif else
        (['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
         if bold else
         ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'])
    )
    for choice in choices:
        if Path(choice).exists():
            return ImageFont.truetype(choice, size)
    return ImageFont.load_default()


def fit_crop(image, size, focus=(0.5, 0.5)):
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    x = max(0, min(image.width - target_w, round(image.width * focus[0] - target_w / 2)))
    y = max(0, min(image.height - target_h, round(image.height * focus[1] - target_h / 2)))
    return image.crop((x, y, x + target_w, y + target_h))


def rounded_paste(canvas, image, box, radius=34, focus=(0.5, 0.5)):
    x, y, width, height = box
    shade = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rounded_rectangle(
        (x + 18, y + 24, x + width + 18, y + height + 24), radius=radius, fill=(0, 0, 0, 95)
    )
    canvas.alpha_composite(shade.filter(ImageFilter.GaussianBlur(20)))
    image = fit_crop(image, (width, height), focus)
    mask = Image.new('L', (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    canvas.paste(image, (x, y), mask)
    ImageDraw.Draw(canvas).rounded_rectangle(
        (x, y, x + width, y + height), radius=radius, outline='#557064', width=2
    )


def focus_image(name):
    image = Image.open(SHOTS / f'{name}.png').convert('RGB')
    if name.startswith('settings'):
        return image.crop((485, 20, 1435, 1060)), (0.5, 0.5)
    if name in {'timing', 'roster', 'summary', 'schedule', 'upcoming'}:
        return image.crop((390, 10, 1530, 1070)), (0.5, 0.5)
    return image, (0.5, 0.5)


scenes = [
    dict(start=0, shot='clock', kicker='MEET TOUCHLINE', title='Keep every game\nmoving.', body='Soccer rotations, a match clock, and the next game—clear from anywhere on the sideline.', tags=['2–5 TEAMS', 'ANDROID + iPAD']),
    dict(start=7, shot='selection', kicker='START IN SECONDS', title='Pick the teams.\nStart the rotation.', body='Choose two through five teams. Touchline builds the schedule and keeps it looping.', tags=['BALANCED ROTATIONS', 'NO SPREADSHEET']),
    dict(start=15, shot='settings-game', kicker='YOUR DEFAULTS', title='Your colors.\nYour timing.', body='Save unique team colors, game length, changeover time, and the opening countdown for every team count.', tags=['SAVED LOCALLY', 'READY NEXT TIME']),
    dict(start=23, shot='settings-session', kicker='FINISH YOUR WAY', title='Play until\nyou’re done.', body='Set an end time. Stop on the dot, finish the current game, or start only the full games that fit.', tags=['HARD STOP', 'FINISH LAST GAME']),
    dict(start=31, shot='settings-audio', kicker='NATIVE AUDIO DUCKING', title='Your music\nstays on.', body='Touchline lowers other audio before an important cue, then brings it smoothly back.', tags=['LISTEN NOW', 'REAL APP AUDIO'], accent=ORANGE),
    dict(start=39, shot='settings-audio', kicker='CLEAR MATCH CUES', title='Warnings you\ncan hear.', body='One minute. Ten seconds. The next teams on deck. Every voice here comes directly from the app.', tags=['NO VOICEOVER', 'ACTUAL CUES'], accent=ORANGE),
    dict(start=47, shot='settings-audio', kicker='FULL TIME', title='The whistle.\nThen the crowd.', body='A referee-style finish and optional stadium roar cut through the touchline noise.', tags=['THREE WHISTLES', 'OPTIONAL CROWD'], accent=ORANGE),
    dict(start=58, shot='board', kicker='THE MATCH BOARD', title='The sideline,\nat a glance.', body='Current teams, the next matchup, timer controls, and session actions stay in one clear view.', tags=['NOW PLAYING', 'UP NEXT']),
    dict(start=66, shot='clock', kicker='MAXIMIZED VIEW', title='A clock built for\nthe whole field.', body='Go full screen in portrait or landscape and keep the essential matchup information in view.', tags=['BIG CLOCK', 'SCREEN AWAKE']),
    dict(start=75, shot='upcoming', kicker='UPCOMING GAMES', title='Jump to\nany game.', body='Open the schedule and make any upcoming matchup the next game with one tap.', tags=['ONE-TAP JUMP', 'END-TIME AWARE']),
    dict(start=84, shot='timing', kicker='CHANGE IT LIVE', title='Change the plan.\nKeep playing.', body='Adjust game time, changeovers, and finish rules during the session without changing saved defaults.', tags=['SESSION ONLY', 'NO RESTART']),
    dict(start=93, shot='roster', kicker='LATE ARRIVALS WELCOME', title='Teams can come\nand go.', body='Choose the exact color arriving or leaving. A fresh fair rotation begins after the current game.', tags=['2–5 TEAMS', 'NO CATCH-UP']),
    dict(start=102, shot='schedule', kicker='FAIR BY DESIGN', title='Fair rotations.\nNo guesswork.', body='See every matchup, understand consecutive appearances, and let each complete schedule balance itself.', tags=['VISIBLE ORDER', 'AUTOMATIC LOOP']),
    dict(start=110, shot='summary', kicker='AFTER THE FINAL WHISTLE', title='End with\nthe full story.', body='Review games played, total playing time, team-by-team minutes, and the full session length.', tags=['MATCH REPORT', 'PLAYING TIME']),
    dict(start=117, shot='clock', kicker='AGED ATHLETICS', title='Less organizing.\nMore playing.', body='Join the Touchline Android test at AgedAthletics.com.', tags=['TOUCHLINE', 'BUILT FOR THE SIDELINE'], closing=True),
]


def draw_background(canvas, accent):
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, W, H), fill=INK)
    for index in range(7):
        pad = 80 + index * 105
        color = '#193a30' if index % 2 else '#21483c'
        draw.arc((W - 760 - pad / 3, -430 + pad / 2, W + 430 - pad / 3, 760 + pad / 2), 120, 330, fill=color, width=2)
    draw.ellipse((93, 91, 107, 105), fill=accent)
    draw.line((0, H - 60, W, H - 60), fill='#294a3f', width=1)


def make_scene(index, scene):
    accent = scene.get('accent', LIME)
    canvas = Image.new('RGBA', (W, H), INK)
    draw_background(canvas, accent)
    draw = ImageDraw.Draw(canvas)
    image, focus = focus_image(scene['shot'])

    if index == 0 or scene.get('closing'):
        backdrop = fit_crop(image, (W, H)).filter(ImageFilter.GaussianBlur(3)).convert('RGBA')
        backdrop.putalpha(90)
        canvas.alpha_composite(backdrop)
        draw.rectangle((0, 0, W, H), fill=(10, 36, 28, 150))
        icon = Image.open(ROOT / 'icon-512.png').convert('RGBA')
        icon.thumbnail((142, 142))
        canvas.alpha_composite(icon, ((W - icon.width) // 2, 118))
        draw.text((W // 2, 322), scene['kicker'], font=font(23, True), fill=accent, anchor='mm')
        title_y = 485 if index == 0 else 500
        for line_no, line in enumerate(scene['title'].split('\n')):
            face = font(94 if index == 0 else 88, bold=line_no == 0, serif=line_no > 0)
            draw.text((W // 2, title_y + line_no * 104), line, font=face, fill=PAPER, anchor='mm')
        draw.text((W // 2, 755), scene['body'], font=font(27), fill=MUTED, anchor='mm')
        tag_width = 260
        left = W // 2 - (len(scene['tags']) * tag_width + (len(scene['tags']) - 1) * 18) // 2
        for tag in scene['tags']:
            draw.rounded_rectangle((left, 842, left + tag_width, 900), 29, fill=PANEL, outline='#507064', width=1)
            draw.text((left + tag_width / 2, 871), tag, font=font(17, True), fill=accent, anchor='mm')
            left += tag_width + 18
    else:
        reverse = index % 2 == 0
        text_x = 1135 if reverse else 90
        image_x = 70 if reverse else 800
        image_width = 990 if reverse else 1050
        rounded_paste(canvas, image, (image_x, 145, image_width, 790), focus=focus)
        draw.text((text_x, 130), scene['kicker'], font=font(21, True), fill=accent)
        y = 205
        for line_no, line in enumerate(scene['title'].split('\n')):
            face = font(70, bold=line_no == 0, serif=line_no > 0)
            draw.text((text_x, y), line, font=face, fill=PAPER)
            y += 82
        y += 32
        for line in textwrap.wrap(scene['body'], width=39):
            draw.text((text_x, y), line, font=font(27), fill=MUTED)
            y += 40
        y += 38
        for tag in scene['tags']:
            bounds = draw.textbbox((0, 0), tag, font=font(16, True))
            width = bounds[2] - bounds[0] + 48
            draw.rounded_rectangle((text_x, y, text_x + width, y + 48), 24, fill=accent)
            draw.text((text_x + 24, y + 24), tag, font=font(16, True), fill=INK, anchor='lm')
            y += 62
    draw.text((90, H - 35), 'TOUCHLINE', font=font(16, True), fill='#82978c', anchor='lm')
    draw.text((W - 90, H - 35), f'{index + 1:02d} / {len(scenes):02d}', font=font(16, True), fill='#82978c', anchor='rm')
    path = FRAMES / f'{index:02d}.png'
    canvas.convert('RGB').save(path, quality=95)
    return path


for number, scene in enumerate(scenes):
    make_scene(number, scene)

Image.open(FRAMES / '00.png').save(POSTER, quality=91, optimize=True)

# Hold every composition completely still. A short editorial dissolve is the
# only visual movement, keeping screenshots comfortable to study.
fade = 0.50
for index, scene in enumerate(scenes):
    next_start = scenes[index + 1]['start'] if index + 1 < len(scenes) else TOTAL
    duration = next_start - scene['start'] + (fade if index + 1 < len(scenes) else 0)
    source = FRAMES / f'{index:02d}.png'
    clip = CLIPS / f'{index:02d}.mp4'
    run('ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', str(FPS), '-i', str(source),
        '-t', f'{duration:.3f}', '-vf', 'format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(FPS), str(clip))

video_only = WORK / 'video-only.mp4'
command = ['ffmpeg', '-y', '-loglevel', 'error']
for index in range(len(scenes)):
    command += ['-i', str(CLIPS / f'{index:02d}.mp4')]
filters = []
last = '[0:v]'
for index in range(1, len(scenes)):
    output = f'[v{index}]'
    filters.append(f'{last}[{index}:v]xfade=transition=fade:duration={fade}:offset={scenes[index]["start"]}{output}')
    last = output
command += ['-filter_complex', ';'.join(filters), '-map', last, '-t', f'{TOTAL:.3f}',
            '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(video_only)]
run(*command)


def duck_expression(windows, low=0.18, ramp=0.5):
    expression = '1'
    for start, end in reversed(windows):
        down = start - ramp
        up = end + ramp
        expression = (
            f'if(between(t,{down:.2f},{start:.2f}),1-(t-{down:.2f})*{(1-low)/ramp:.3f},'
            f'if(between(t,{start:.2f},{end:.2f}),{low},'
            f'if(between(t,{end:.2f},{up:.2f}),{low}+(t-{end:.2f})*{(1-low)/ramp:.3f},{expression})))'
        )
    return expression


music_ducks = [(33.0, 34.4), (39.8, 41.7), (43.5, 59.0)]
music_filter = duck_expression(music_ducks)
if not MUSIC.exists():
    raise SystemExit(f'Missing licensed background track: {MUSIC}')

final = WORK / 'final.mp4'
audio_inputs = [
    MUSIC,
    ROOT / 'audio/referee.mp3',
    ROOT / 'audio/minute.mp3',
    ROOT / 'audio/ten.mp3',
    ROOT / 'audio/callouts/deck-red-black.mp3',
    ROOT / 'audio/referee.mp3',
    ROOT / 'audio/referee.mp3',
    ROOT / 'audio/referee.mp3',
    ROOT / 'audio/crowd.mp3',
]
mix = [
    f"[1:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,volume='0.92*({music_filter})':eval=frame,afade=t=in:st=0:d=1.2,afade=t=out:st=120.2:d=2.8[bed]",
    '[2:a]atrim=0:1.25,asetpts=PTS-STARTPTS,afade=t=out:st=1.18:d=0.07,adelay=33000:all=1[kickoff]',
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
for source in audio_inputs:
    command += ['-i', str(source)]
command += ['-filter_complex', ';'.join(mix), '-map', '0:v', '-map', '[mix]', '-t', f'{TOTAL:.3f}',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', str(final)]
run(*command)
shutil.copy2(final, OUT)

VTT.write_text("""WEBVTT

00:00:00.000 --> 00:00:32.500
[Upbeat instrumental music]

00:00:33.000 --> 00:00:34.300
[Referee kickoff whistle]

00:00:34.300 --> 00:00:39.700
[Instrumental music returns]

00:00:39.800 --> 00:00:41.400
One minute remaining.

00:00:43.500 --> 00:00:45.500
Ten seconds remaining.

00:00:45.800 --> 00:00:48.400
Team red and team black, you're on deck!

00:00:49.200 --> 00:00:52.550
[Three referee whistles]

00:00:52.550 --> 00:00:58.550
[Stadium crowd roars beneath the music]

00:00:58.550 --> 00:02:03.120
[Upbeat instrumental music]
""")

probe = subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', str(OUT)
], text=True)
print(json.dumps({'video': str(OUT), 'poster': str(POSTER), 'captions': str(VTT), **json.loads(probe)['format']}))
