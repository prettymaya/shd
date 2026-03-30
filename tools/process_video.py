#!/usr/bin/env python3
import sys
import os
import argparse
import time
import yt_dlp
import whisper
import datetime
import traceback
import ssl
import imageio_ffmpeg

# Fix macOS Python SSL certificate issue
ssl._create_default_https_context = ssl._create_unverified_context

# Setup: ensure ffmpeg/ffprobe symlinks exist in tools/bin/ so yt-dlp and whisper can find them
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_DIR = os.path.join(SCRIPT_DIR, "bin")
os.makedirs(BIN_DIR, exist_ok=True)

_ffmpeg_src = imageio_ffmpeg.get_ffmpeg_exe()
_ffmpeg_link = os.path.join(BIN_DIR, "ffmpeg")
_ffprobe_link = os.path.join(BIN_DIR, "ffprobe")

if not os.path.exists(_ffmpeg_link):
    os.symlink(_ffmpeg_src, _ffmpeg_link)
if not os.path.exists(_ffprobe_link):
    os.symlink(_ffmpeg_src, _ffprobe_link)

# Prepend bin/ to PATH so all tools (yt-dlp, whisper) find ffmpeg
os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")

# Available models (smallest to largest):
# tiny.en  -> ~1GB RAM,  super fast,  OK quality
# base.en  -> ~1GB RAM,  very fast,   good quality
# small.en -> ~2GB RAM,  fast,        great quality   ← DEFAULT (best for English shadowing)
# medium.en-> ~5GB RAM,  moderate,    excellent quality
# turbo    -> ~6GB RAM,  slow,        best quality (overkill for most cases)
MODELS_INFO = {
    'tiny.en':   '~39M params  | Super fast  | OK quality',
    'base.en':   '~74M params  | Very fast   | Good quality',
    'small.en':  '~244M params | Fast        | Great quality ⭐ Recommended',
    'medium.en': '~769M params | Moderate    | Excellent quality',
    'turbo':     '~809M params | Slow        | Best quality (heavy on Mac Air)',
}


def format_timestamp(seconds: float) -> str:
    """Formats float seconds into HH:MM:SS string."""
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    sec = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{sec:02d}"


def download_video(url: str, output_dir: str = "."):
    """Downloads a video from a URL and merges it to MP4."""
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'merge_output_format': 'mp4',
        'restrictfilenames': True,
        'noplaylist': True,
        'ffmpeg_location': BIN_DIR,
    }

    print(f"[*] Downloading video from: {url}")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info_dict)
        if not filename.endswith('.mp4'):
            filename = os.path.splitext(filename)[0] + '.mp4'
        return filename, info_dict.get('duration', 0)


def process_video(url: str, model_name: str = "small.en"):
    os.makedirs("downloads", exist_ok=True)
    try:
        # 1. Download Video
        video_path, duration = download_video(url, output_dir="downloads")
        print(f"[+] Video downloaded to: {video_path}")
        if duration:
            print(f"[+] Video duration: {format_timestamp(duration)}")

        # 2. Load Whisper model
        print(f"\n[*] Loading Whisper model: {model_name}")
        if model_name in MODELS_INFO:
            print(f"    {MODELS_INFO[model_name]}")

        import torch
        if torch.backends.mps.is_available():
            device = "mps"
            print("[+] Apple Silicon GPU (MPS) detected — using GPU! 🚀")
        else:
            device = "cpu"
            print("[!] No GPU found, using CPU")

        model = whisper.load_model(model_name, device=device)

        # 3. Transcribe with progress
        print(f"\n[*] Transcribing audio... (this may take a while)")
        if duration:
            # Estimate: small.en processes ~5-10x realtime on M4 MPS
            speed_factor = 10 if device == "mps" else 3
            est_seconds = max(10, duration / speed_factor)
            est_min = int(est_seconds // 60)
            est_sec = int(est_seconds % 60)
            print(f"[*] Estimated time: ~{est_min}m {est_sec}s")

        start_time = time.time()

        # verbose=True shows each segment as it's transcribed (live progress)
        result = model.transcribe(
            video_path,
            language="en",
            task="transcribe",
            verbose=True,  # Shows real-time progress per segment
        )

        elapsed = time.time() - start_time
        el_min = int(elapsed // 60)
        el_sec = int(elapsed % 60)
        print(f"\n[+] Transcription completed in {el_min}m {el_sec}s!")

        segments = result.get('segments', [])

        if not segments:
            print("[-] No speech segments detected.")
            return

        # 4. Save formatted text file
        transcript_path = os.path.splitext(video_path)[0] + ".txt"
        print(f"[*] Saving transcript to: {transcript_path}")

        with open(transcript_path, "w", encoding="utf-8") as f:
            for seg in segments:
                stamp = format_timestamp(seg['start'])
                text = seg['text'].strip()
                f.write(f"{stamp}\n")
                f.write(f"{text}\n\n")

        print(f"\n{'='*50}")
        print(f"  ✅ All done! {len(segments)} sentences extracted.")
        print(f"  📹 Video: {video_path}")
        print(f"  📝 Text:  {transcript_path}")
        print(f"{'='*50}")
        print("[*] Drag and drop both files into your ShadowTED website!")

    except Exception as e:
        print(f"[-] An error occurred: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download & Transcribe videos for ShadowTED practice.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available models (use --model):
  tiny.en    ~39M params  | Super fast  | OK quality
  base.en    ~74M params  | Very fast   | Good quality
  small.en   ~244M params | Fast        | Great quality ⭐ Default
  medium.en  ~769M params | Moderate    | Excellent quality
  turbo      ~809M params | Slow        | Best quality

Examples:
  python process_video.py "https://youtu.be/..." 
  python process_video.py "https://youtu.be/..." --model tiny.en
  python process_video.py "https://youtu.be/..." --model medium.en
        """
    )
    parser.add_argument("url", help="URL of the YouTube or TED video")
    parser.add_argument("--model", default="small.en", choices=MODELS_INFO.keys(),
                        help="Whisper model to use (default: small.en)")

    args = parser.parse_args()
    process_video(args.url, model_name=args.model)
