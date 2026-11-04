# Touchline motion video

The finished two-minute visual tour is published at `docs/assets/touchline-training.mp4`, with WebVTT captions beside it. It uses the supplied Touchline Break music, animated app screens, short on-screen feature callouts, and the real in-app whistle, warnings, team callout, and crowd audio. There is no narration.

To rebuild the video on macOS:

```sh
python3 training/make_training_video.py
```

The build uses Pillow and FFmpeg/FFprobe. It produces a 1920×1080 H.264/AAC MP4 suitable for web playback, a matching poster, and a caption file for the audible cues. The licensed background track must be present at `training/audio/touchline-break.m4a`.
