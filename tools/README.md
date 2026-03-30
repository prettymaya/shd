# ShadowTED Processing Tools

This directory contains standalone tools to download YouTube / TED videos and automatically generate ShadowTED-compatible sentence-level timestamps using Whisper Large V3 Turbo.

## Prerequisites (macOS)

1. **Install FFmpeg**: Whisper and yt-dlp require FFmpeg to process audio and video files. Open your Terminal and run:
   ```bash
   brew install ffmpeg
   ```
   *(If you don't have Homebrew installed, get it from [brew.sh](https://brew.sh))*

2. **Install Python Requirements**: From inside this `tools` folder, run:
   ```bash
   pip3 install -r requirements.txt
   ```
   *(We highly recommend doing this inside a Python virtual environment: `python3 -m venv venv && source venv/bin/activate`)*

## Usage

1. Open your terminal and navigate to the tools folder:
   ```bash
   cd tools
   ```
2. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
3. Run the script by passing the URL of the video:
   ```bash
   python process_video.py "https://www.youtube.com/watch?v=..."
   ```

### What happens?
1. The script downloads the video into the `downloads` folder as an `.mp4` file.
2. It runs **Whisper Large V3 Turbo** locally to transcribe the audio.
3. It creates a `.txt` file exactly matching the ShadowTED format (`HH:MM:SS` followed by the sentence text).
4. You can drag and drop BOTH generated files into your ShadowTED website and start playing instantly!
