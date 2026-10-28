#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import subprocess, json, textwrap, math, re, shutil

ROOT=Path(__file__).resolve().parents[1]
WORK=Path('/tmp/touchline-training')
SHOTS=ROOT/'training/screenshots'; FRAMES=WORK/'frames'; AUDIO=WORK/'audio'; CLIPS=WORK/'clips'
for p in (FRAMES,AUDIO,CLIPS): p.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'docs/assets/touchline-training.mp4'
VTT=ROOT/'docs/assets/touchline-training.vtt'
SCRIPT=ROOT/'training/touchline-training-script.md'
W,H=1920,1080
BG='#10251f'; PANEL='#17352c'; INK='#f5f3e8'; MUTED='#c8d0c5'; ACCENT='#d8ef75'; ORANGE='#e28c56'
font_paths=[
 '/System/Library/Fonts/SFNS.ttf',
 '/System/Library/Fonts/Supplemental/Arial.ttf']
bold_paths=['/System/Library/Fonts/SFNS.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf']
def font(size,bold=False):
 for p in (bold_paths if bold else font_paths):
  if Path(p).exists(): return ImageFont.truetype(p,size)
 return ImageFont.load_default()

def wrap(draw,text,f,maxw):
 words=text.split(); lines=[]; line=''
 for word in words:
  test=(line+' '+word).strip()
  if draw.textbbox((0,0),test,font=f)[2] <= maxw: line=test
  else:
   if line: lines.append(line)
   line=word
 if line: lines.append(line)
 return lines

def rounded_image(canvas,src,box,radius=26):
 x,y,w,h=box
 im=src.copy(); im.thumbnail((w,h),Image.Resampling.LANCZOS)
 layer=Image.new('RGB',(w,h),BG); ox=(w-im.width)//2; oy=(h-im.height)//2; layer.paste(im,(ox,oy))
 mask=Image.new('L',(w,h),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius=radius,fill=255)
 canvas.paste(layer,(x,y),mask)

def crop_for(scene,im):
 if scene.startswith('settings'):
  return im.crop((530,35,1390,1045))
 if scene in {'premium','roster','timing','upcoming','summary','schedule'}:
  return im.crop((430,25,1490,1055))
 return im

scenes=[
 dict(id='title',shot='selection',title='TOUCHLINE',kicker='COMPLETE APP WALKTHROUGH',bullets=['Set up once','Run every game','Finish with a match report'],narration='Welcome to Touchline. In the next few minutes, you will learn every control you need to set up a rotation, run a session, change plans on the sideline, and review the final match report.'),
 dict(id='selection',shot='selection',title='Choose a rotation',kicker='START HERE',bullets=['2–3 teams: free and unlimited','4–5 teams: Premium','Each team count keeps its own defaults'],narration='Start on the selection screen and choose two, three, four, or five teams. Two- and three-team sessions are free and unlimited. Four and five teams require the one-time Premium unlock. Each card also shows that team count’s saved colours, game time, and changeover time.'),
 dict(id='settings-game',shot='settings-game',title='Save game defaults',kicker='SETTINGS · GAME',bullets=['Five unique colours, used in order','Game and changeover: 1 second–24 hours','Optional 5-second opening countdown'],narration='Open Settings at the bottom of the selection screen. Defaults are saved separately for each team count. On the Game tab, choose five unique colours; smaller sessions use the first colours in that order. Set game and changeover durations from one second to twenty-four hours. You can also enable the five-second opening countdown. Save Defaults stores these choices on this device.'),
 dict(id='settings-session',shot='settings-session',title='Control when play ends',kicker='SETTINGS · SESSION',bullets=['Hard stop: may shorten the last game','Finish last game: complete one in progress','Full games only: skip games that do not fit'],narration='The Session tab can set an end time for today. Hard Stop ends exactly on time and may shorten the final game if it meets your minimum. Finish Last Game allows a game started before the deadline to finish. Full Games Only starts only games that fit completely. Disable the end time for continuous rotation.'),
 dict(id='settings-audio',shot='settings-audio',title='Choose every sound',kicker='SETTINGS · AUDIO',bullets=['Master sound switch plus individual cues','Kickoff, 1:00, 0:30 and 0:10 warnings','Full-time whistle, countdown, callouts and crowd'],narration='On the Audio tab, the master switch controls timer sounds. Then enable or disable each cue: kickoff whistle, one-minute, thirty-second, and ten-second warnings, the full-time whistle, the five-to-one countdown, team callouts, and stadium crowd. Tap Test beside any cue to preview it. On supported phones, Touchline briefly ducks other audio so important announcements are clear.'),
 dict(id='board',shot='board',title='Run the game',kicker='MATCH BOARD',bullets=['Start, pause and resume','Restart the current game','Add or remove 30 seconds'],narration='After choosing teams, the match board shows Now Playing and Up Next. Start begins the optional timer; the same button pauses and resumes it. Minus or plus thirty seconds adjusts only the current game or changeover. Restart Game restores the full game time and pauses, which is useful after a false start. The timer moves automatically through the changeover and into the next game.'),
 dict(id='clock',shot='clock',title='Use the full-screen clock',kicker='SIDELINE VIEW',bullets=['Large clock in portrait or landscape','Current teams above the timer','Up Next stays visible'],narration='Tap Maximize for the largest possible clock. The current teams stay above the timer, while Up Next remains visible in a compact position. Tap the same icon again to return to the full board. Keep Screen Awake helps prevent the display from sleeping while Touchline remains visible.'),
 dict(id='upcoming',shot='upcoming',title='Jump to any game',kicker='NAVIGATION',bullets=['Tap Up Next for a one-step jump','List shows every game before the end time','Previous and Next reset and pause the timer'],narration='Tap the Up Next card to jump there immediately, or open the list icon to see all upcoming games. The list includes every game that can start before the session end time; continuous sessions show one full rotation. Tap any listed game to play it next. Previous and Next also move manually, reset the timer, and leave it paused.'),
 dict(id='timing',shot='timing',title='Change today’s plan',kicker='SESSION TIMING',bullets=['Change game and changeover lengths','Edit end time and finish rule','Applies only to this session'],narration='Session Timing changes game length, changeover length, the end time, finish rule, and minimum shortened game while play is underway. These are session-only changes, so your saved defaults remain untouched. The current phase keeps its remaining time, and new durations begin with the next phase.'),
 dict(id='roster',shot='roster',title='Add or remove teams',kicker='LIVE ROSTER',bullets=['Choose the exact departing or arriving colour','Change begins after the current game and changeover','A fresh fair rotation starts with no catch-up games'],narration='Use minus Team or plus Team to change the roster between two and five teams. Choose the exact colour leaving or arriving. During play, the current game and changeover finish first, then Touchline begins a fresh rotation. Late arrivals do not need catch-up games, and a newly added colour applies only to this session.'),
 dict(id='schedule',shot='schedule',title='Review the rotation',kicker='FAIRNESS',bullets=['See every matchup in order','Warnings identify back-to-back appearances','The rotation loops automatically'],narration='View Rotation and Fairness lists every matchup and explains the schedule. Touchline warns when a smaller rotation requires a back-to-back appearance. Complete cycles balance game counts, and every schedule loops automatically. The five-team cycle avoids consecutive appearances, including across the loop boundary.'),
 dict(id='summary',shot='summary',title='Finish with a match report',kicker='END SESSION',bullets=['Stop button ends play after confirmation','Games and playing time for every team','Average playing time and total session time'],narration='Tap End Session, shown with the stop icon, and confirm when play is finished. Touchline records partial game time already played, then shows total session time, average playing time, games played, and each team’s playing time. Close the report to review the board, or return to selection for another session.'),
 dict(id='premium',shot='premium',title='Premium and saved purchases',kicker='ANDROID',bullets=['One-time unlock for 4–5 teams','Restore Purchase on another compatible install','Settings and active session save locally'],narration='On Android, Premium is a one-time Google Play purchase that unlocks four- and five-team rotations. Use Restore Purchase if the same Google account already owns it. Your settings and active session are stored locally, and the native apps bundle their audio for offline use. That is everything you need to run Touchline to its fullest.'),
]

# Produce slide frames.
for idx,s in enumerate(scenes,1):
 shot=Image.open(SHOTS/f"{s['shot']}.png").convert('RGB')
 if s['id']=='title':
  bg=shot.resize((W,H)).filter(ImageFilter.GaussianBlur(10)).convert('RGBA')
  shade=Image.new('RGBA',(W,H),(12,36,29,205)); bg.alpha_composite(shade)
  canvas=bg.convert('RGB'); d=ImageDraw.Draw(canvas)
  icon=Image.open(ROOT/'icon-512.png').convert('RGBA'); icon.thumbnail((170,170)); canvas.paste(icon,(875,160),icon)
  d.text((W//2,375),s['title'],font=font(110,True),fill=INK,anchor='mm')
  d.text((W//2,470),s['kicker'],font=font(28,True),fill=ACCENT,anchor='mm')
  d.rounded_rectangle((420,570,1500,770),radius=34,fill=PANEL)
  x=520
  for b in s['bullets']:
   d.ellipse((x,657,x+14,671),fill=ACCENT); d.text((x+28,665),b,font=font(29,True),fill=INK,anchor='lm'); x+=320
  d.text((W//2,910),'A little structure. A lot of soccer.',font=font(28),fill=MUTED,anchor='mm')
 else:
  canvas=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(canvas)
  d.text((60,54),s['kicker'],font=font(24,True),fill=ACCENT)
  d.text((60,90),s['title'],font=font(54,True),fill=INK)
  d.text((1810,67),f'{idx:02d} / {len(scenes):02d}',font=font(22,True),fill=MUTED,anchor='ra')
  src=crop_for(s['shot'],shot)
  rounded_image(canvas,src,(60,180,1240,820),30)
  d.rounded_rectangle((1340,180,1860,1000),radius=30,fill=PANEL)
  y=250
  for n,b in enumerate(s['bullets'],1):
   d.rounded_rectangle((1390,y,1440,y+50),radius=25,fill=ACCENT)
   d.text((1415,y+25),str(n),font=font(22,True),fill=BG,anchor='mm')
   lines=wrap(d,b,font(30,True),340)
   for line in lines:
    d.text((1470,y+3),line,font=font(30,True),fill=INK)
    y+=39
   y+=70
  d.text((1388,936),'TOUCHLINE',font=font(19,True),fill=MUTED)
  d.text((1810,936),'LESS ORGANIZING. MORE PLAYING.',font=font(15,True),fill=MUTED,anchor='ra')
 canvas.save(FRAMES/f'{idx:02d}-{s["id"]}.png',quality=95)

# Narration script for editing/re-recording.
SCRIPT.write_text('# Touchline training video narration\n\nVoice: calm, clear female narrator. Current build uses the macOS Moira voice.\n\n'+''.join(f"## {i}. {s['title']}\n\n{s['narration']}\n\n" for i,s in enumerate(scenes,1)))

# Generate one narration file per scene.
def run(*args): subprocess.run(args,check=True)
def duration(path):
 out=subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)],text=True)
 return float(json.loads(out)['format']['duration'])

timings=[]; cursor=0.0
for idx,s in enumerate(scenes,1):
 aiff=AUDIO/f'{idx:02d}.aiff'; wav=AUDIO/f'{idx:02d}.wav'
 run('say','-v','Moira','-r','168','-o',str(aiff),s['narration'])
 run('ffmpeg','-y','-loglevel','error','-i',str(aiff),'-af','highpass=f=70,loudnorm=I=-17:TP=-2:LRA=8','-ar','48000','-ac','1',str(wav))
 dur=duration(wav)+1.0
 timings.append((cursor,cursor+dur,s)); cursor+=dur
 frame=FRAMES/f'{idx:02d}-{s["id"]}.png'; clip=CLIPS/f'{idx:02d}.mp4'
 fadeout=max(0.5,dur-0.35)
 vf=f"fade=t=in:st=0:d=0.35,fade=t=out:st={fadeout:.3f}:d=0.35,format=yuv420p"
 af=f"afade=t=in:st=0:d=0.15,afade=t=out:st={fadeout:.3f}:d=0.35"
 run('ffmpeg','-y','-loglevel','error','-loop','1','-framerate','30','-i',str(frame),'-i',str(wav),'-vf',vf,'-af',af,'-t',f'{dur:.3f}','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(clip))

concat=WORK/'concat.txt'; concat.write_text(''.join(f"file '{(CLIPS/f'{i:02d}.mp4').as_posix()}'\n" for i in range(1,len(scenes)+1)))
run('ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(OUT))

# Create readable sentence-level WebVTT captions.
def ts(sec):
 ms=round(sec*1000); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
 return f'{h:02d}:{m:02d}:{s:02d}.{ms:03d}'
lines=['WEBVTT','']
for start,end,s in timings:
 sentences=[x.strip() for x in re.split(r'(?<=[.!?])\s+',s['narration']) if x.strip()]
 weights=[max(1,len(x)) for x in sentences]; total=sum(weights); t=start+0.15; usable=max(0.5,end-start-0.45)
 for sentence,w in zip(sentences,weights):
  e=min(end-0.15,t+usable*w/total)
  lines += [f'{ts(t)} --> {ts(e)}',sentence,'']; t=e
VTT.write_text('\n'.join(lines))
print(json.dumps({'video':str(OUT),'captions':str(VTT),'script':str(SCRIPT),'duration_seconds':round(cursor,1),'scenes':len(scenes)}))
