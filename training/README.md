# Touchline training video

The finished walkthrough is published at `docs/assets/touchline-training.mp4`, with WebVTT captions beside it. The narration is in `touchline-training-script.md` and the captured app screens are in `screenshots/`.

To rebuild the video on macOS:

```sh
python3 training/make_training_video.py
```

The build uses Pillow, FFmpeg/FFprobe, and the built-in macOS `say` command with the Moira voice. It produces a 1920×1080 H.264/AAC MP4 suitable for web playback and a matching caption file.
