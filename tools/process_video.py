#!/usr/bin/env python3
"""Download YouTube videos and transcribe for ShadowTED.

Engines:
  --engine deepgram   → Deepgram Nova-3 (best quality, cloud, free $200 credit)
  --engine whisper    → whisper.cpp + Metal GPU (local, no internet needed)
"""
import sys
import os
import argparse
import subprocess
import re
import time
import traceback
import ssl
import json
import imageio_ffmpeg

# Fix macOS Python SSL certificate issue
ssl._create_default_https_context = ssl._create_unverified_context

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_DIR = os.path.join(SCRIPT_DIR, "bin")
WHISPER_CPP = os.path.join(SCRIPT_DIR, "whisper.cpp")
WHISPER_CLI = os.path.join(WHISPER_CPP, "build", "bin", "whisper-cli")
MODELS_DIR = os.path.join(WHISPER_CPP, "models")
ENV_FILE = os.path.join(SCRIPT_DIR, ".env")

os.makedirs(BIN_DIR, exist_ok=True)

# Setup ffmpeg symlinks
_ffmpeg_src = imageio_ffmpeg.get_ffmpeg_exe()
_ffmpeg_link = os.path.join(BIN_DIR, "ffmpeg")
_ffprobe_link = os.path.join(BIN_DIR, "ffprobe")

if not os.path.exists(_ffmpeg_link):
    os.symlink(_ffmpeg_src, _ffmpeg_link)
if not os.path.exists(_ffprobe_link):
    os.symlink(_ffmpeg_src, _ffprobe_link)

os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")

# Whisper models
WHISPER_MODELS = {
    'base': 'ggml-base.bin',
    'small': 'ggml-small.bin',
    'medium': 'ggml-medium.bin',
    'large-v3': 'ggml-large-v3.bin',
}


def load_env():
    """Load API keys from .env file."""
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip()


def format_timestamp(seconds: float) -> str:
    total = int(seconds)
    h, m, s = total // 3600, (total % 3600) // 60, total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def download_video(url: str, output_dir: str = "."):
    """Download video using yt-dlp."""
    import yt_dlp
    ydl_opts = {
        # Max 480p for smaller files (good enough for shadowing, ~15-25MB for 15min)
        'format': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best',
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'merge_output_format': 'mp4',
        'restrictfilenames': True,
        'noplaylist': True,
        'ffmpeg_location': BIN_DIR,
    }

    print(f"📥  Downloading video...")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        if not filename.endswith('.mp4'):
            filename = os.path.splitext(filename)[0] + '.mp4'
        return filename, info.get('duration', 0)


def extract_audio_wav(video_path: str) -> str:
    """Extract audio as 16kHz mono WAV."""
    wav_path = os.path.splitext(video_path)[0] + ".wav"
    ffmpeg = os.path.join(BIN_DIR, "ffmpeg")
    print(f"🎵  Extracting audio...")
    subprocess.run([
        ffmpeg, '-i', video_path,
        '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        wav_path, '-y'
    ], capture_output=True, check=True)
    return wav_path


# ─── DEEPGRAM ENGINE ──────────────────────────────────────────────

def transcribe_deepgram(wav_path: str) -> list:
    """Transcribe using Deepgram Nova-3 API (best quality)."""
    api_key = os.environ.get("DEEPGRAM_API_KEY", "")
    if not api_key:
        print("❌  DEEPGRAM_API_KEY not set!")
        print("    1. Sign up free: https://console.deepgram.com/signup")
        print("    2. Get $200 free credit")
        print(f"    3. Save key in: {ENV_FILE}")
        print(f"       DEEPGRAM_API_KEY=your_key_here")
        return []

    print(f"🧠  Transcribing with Deepgram Nova-3 (cloud)...")
    start_time = time.time()

    # Read audio file
    with open(wav_path, 'rb') as f:
        audio_data = f.read()

    import requests as req_lib

    url = "https://api.deepgram.com/v1/listen"
    params = {
        "model": "nova-3",
        "language": "en",
        "punctuate": "true",
        "paragraphs": "true",
        "utterances": "true",
        "utt_split": "0.8",
        "smart_format": "true",
    }
    headers = {
        'Authorization': f'Token {api_key}',
        'Content-Type': 'audio/wav',
    }

    file_mb = len(audio_data) / (1024 * 1024)
    print(f"    Uploading {file_mb:.1f} MB audio...")

    resp = req_lib.post(url, params=params, headers=headers, data=audio_data, timeout=600)
    resp.raise_for_status()
    result = resp.json()

    elapsed = time.time() - start_time
    print(f"⚡  Done in {elapsed:.1f}s")
    print()

    segments = []

    # Use paragraphs -> sentences for proper sentence-level segmentation
    channels = result.get('results', {}).get('channels', [])
    if channels:
        for alt in channels[0].get('alternatives', []):
            paragraphs = alt.get('paragraphs', {}).get('paragraphs', [])
            if paragraphs:
                for para in paragraphs:
                    for sent in para.get('sentences', []):
                        text = sent.get('text', '').strip()
                        if text:
                            segments.append({
                                'start': sent['start'],
                                'end': sent['end'],
                                'text': text,
                            })
                            print(f"  [{format_timestamp(sent['start'])}]  {text}")

    # Fallback: use utterances if paragraphs not available
    if not segments:
        utterances = result.get('results', {}).get('utterances', [])
        for utt in utterances:
            text = utt.get('transcript', '').strip()
            if not text:
                continue
            segments.append({
                'start': utt['start'],
                'end': utt['end'],
                'text': text,
            })
            print(f"  [{format_timestamp(utt['start'])}]  {text}")

    return segments


# ─── WHISPER.CPP ENGINE ───────────────────────────────────────────

def transcribe_whisper(wav_path: str, model_name: str = "large-v3") -> list:
    """Transcribe using whisper.cpp with Metal GPU acceleration."""
    model_file = os.path.join(MODELS_DIR, WHISPER_MODELS[model_name])

    if not os.path.exists(model_file):
        print(f"❌  Model not found: {model_file}")
        print(f"    Run: cd whisper.cpp && bash models/download-ggml-model.sh {model_name}")
        return []
    if not os.path.exists(WHISPER_CLI):
        print(f"❌  whisper-cli not found. Build whisper.cpp first.")
        return []

    print(f"🧠  Transcribing with whisper.cpp ({model_name}) + Metal GPU 🚀")
    print()

    process = subprocess.Popen([
        WHISPER_CLI,
        '-m', model_file,
        '-f', wav_path,
        '-l', 'en',
        '--print-progress',
    ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    segments = []
    pattern = r'\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)'

    for line in process.stdout:
        line = line.rstrip()
        match = re.match(pattern, line)
        if match:
            start_str, end_str, text = match.group(1), match.group(2), match.group(3).strip()
            print(f"  {line}")

            parts = start_str.split(':')
            start = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
            parts = end_str.split(':')
            end = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])

            if text and not text.startswith('[') and not text.startswith('('):
                segments.append({'start': start, 'end': end, 'text': text})
        elif 'total time' in line:
            print(f"\n  ⏱  {line.strip()}")
        elif 'progress' in line:
            print(f"  {line.strip()}")

    process.wait()
    return segments


# ─── MAIN PIPELINE ────────────────────────────────────────────────

def process_video(url: str, engine: str = "deepgram", model_name: str = "large-v3"):
    os.makedirs("downloads", exist_ok=True)
    load_env()

    try:
        # 1. Download
        video_path, duration = download_video(url, output_dir="downloads")
        print(f"✅  Video: {video_path}")
        if duration:
            print(f"⏱   Duration: {format_timestamp(duration)}")

        # 2. Extract audio
        wav_path = extract_audio_wav(video_path)

        # 3. Transcribe
        print()
        if engine == "deepgram":
            segments = transcribe_deepgram(wav_path)
        else:
            segments = transcribe_whisper(wav_path, model_name)

        if not segments:
            print("❌  No segments found.")
            return

        # 4. Save ShadowTED format
        txt_path = os.path.splitext(video_path)[0] + ".txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            for s in segments:
                f.write(f"{format_timestamp(s['start'])}\n")
                f.write(f"{s['text']}\n\n")

        print(f"\n{'='*55}")
        print(f"  ✅  {len(segments)} sentences extracted!")
        print(f"  📹  Video: {os.path.basename(video_path)}")
        print(f"  📝  Text:  {os.path.basename(txt_path)}")
        print(f"  🔤  Engine: {engine}" + (f" ({model_name})" if engine == "whisper" else " (Nova-3)"))
        print(f"{'='*55}")
        print("  Drag both files into ShadowTED! 🎯")

        # Cleanup
        os.remove(wav_path)

    except Exception as e:
        print(f"❌  Error: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download & transcribe videos for ShadowTED.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Engines:
  deepgram   🏆 Best quality (Deepgram Nova-3, cloud, free $200 credit)
  whisper    🖥️  Local only (whisper.cpp + Metal GPU, no internet)

Setup Deepgram:
  1. Sign up: https://console.deepgram.com/signup ($200 free credit)
  2. Create .env file in tools/ folder:
     DEEPGRAM_API_KEY=your_key_here

Examples:
  python process_video.py "https://youtu.be/..."
  python process_video.py "https://youtu.be/..." --engine whisper
  python process_video.py "https://youtu.be/..." --engine whisper --model medium
        """
    )
    parser.add_argument("url", help="Video URL")
    parser.add_argument("--engine", default="deepgram", choices=["deepgram", "whisper"],
                        help="Transcription engine (default: deepgram)")
    parser.add_argument("--model", default="large-v3", choices=WHISPER_MODELS.keys(),
                        help="Whisper model (only for --engine whisper)")

    args = parser.parse_args()
    process_video(args.url, engine=args.engine, model_name=args.model)
