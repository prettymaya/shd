#!/usr/bin/env python3
import sys
import os
import argparse
import time
import datetime
import traceback
import ssl
import imageio_ffmpeg

# Fix macOS Python SSL certificate issue
ssl._create_default_https_context = ssl._create_unverified_context

# Setup: ensure ffmpeg/ffprobe symlinks exist in tools/bin/
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

os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")

# Available models
MODELS_INFO = {
    'tiny':           '~39M  | ⚡ Super fast | Basic quality',
    'base':           '~74M  | ⚡ Very fast  | Good quality',
    'small':          '~244M | ⚡ Fast       | Great quality',
    'medium':         '~769M | 🔄 Moderate   | Excellent quality',
    'distil-large-v3':'~756M | ⚡ Fast       | Near-best quality ⭐ Best balance',
    'large-v3-turbo': '~809M | 🔄 Moderate   | Very high quality',
    'large-v3':       '~1.5B | 🐢 Slow       | Best quality 👑',
}

# Some models need HuggingFace model IDs for faster-whisper
MODEL_ID_MAP = {
    'distil-large-v3': 'Systran/faster-distil-whisper-large-v3',
    'large-v3-turbo':  'deepdml/faster-whisper-large-v3-turbo-ct2',
}


def format_timestamp(seconds: float) -> str:
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    sec = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{sec:02d}"


def download_video(url: str, output_dir: str = "."):
    import yt_dlp
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


def process_video(url: str, model_name: str = "small"):
    os.makedirs("downloads", exist_ok=True)
    try:
        # 1. Download Video
        video_path, duration = download_video(url, output_dir="downloads")
        print(f"[+] Video downloaded: {video_path}")
        if duration:
            print(f"[+] Duration: {format_timestamp(duration)}")

        # 2. Load faster-whisper model
        from faster_whisper import WhisperModel

        print(f"\n[*] Loading faster-whisper model: {model_name}")
        if model_name in MODELS_INFO:
            print(f"    {MODELS_INFO[model_name]}")

        # Resolve model ID (some models use HuggingFace IDs)
        resolved_model = MODEL_ID_MAP.get(model_name, model_name)

        # INT8 quantization = fast + low memory on CPU
        print("[*] Using INT8 quantization (optimized for CPU) 🧊")
        model = WhisperModel(
            resolved_model,
            device="cpu",
            compute_type="int8",
        )

        # 3. Transcribe with VAD filtering
        print(f"\n[*] Transcribing audio with VAD filtering...")
        if duration:
            fast_models = ['tiny', 'base', 'small', 'distil-large-v3']
            speed_factor = 8 if model_name in fast_models else 4
            est = max(10, duration / speed_factor)
            print(f"[*] Estimated time: ~{int(est//60)}m {int(est%60)}s")

        start_time = time.time()

        segments_gen, info = model.transcribe(
            video_path,
            language="en",
            beam_size=5,
            vad_filter=True,           # Filters out silence/noise
            vad_parameters=dict(
                min_silence_duration_ms=300,
            ),
            condition_on_previous_text=True,
        )

        # Collect segments with live progress
        segments = []
        for seg in segments_gen:
            segments.append(seg)
            print(f"  [{format_timestamp(seg.start)} -> {format_timestamp(seg.end)}] {seg.text.strip()}")

        elapsed = time.time() - start_time
        print(f"\n[+] Transcription done in {int(elapsed//60)}m {int(elapsed%60)}s")

        if not segments:
            print("[-] No speech segments detected.")
            return

        # 4. Save formatted text file for ShadowTED
        transcript_path = os.path.splitext(video_path)[0] + ".txt"

        with open(transcript_path, "w", encoding="utf-8") as f:
            for seg in segments:
                stamp = format_timestamp(seg.start)
                text = seg.text.strip()
                f.write(f"{stamp}\n")
                f.write(f"{text}\n\n")

        print(f"\n{'='*50}")
        print(f"  ✅ Done! {len(segments)} sentences extracted.")
        print(f"  📹 Video: {video_path}")
        print(f"  📝 Text:  {transcript_path}")
        print(f"{'='*50}")
        print("[*] Drag and drop both files into ShadowTED!")

    except Exception as e:
        print(f"[-] Error: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download & Transcribe videos for ShadowTED.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Models (use --model):
  tiny       ⚡ Super fast  | Basic quality
  base       ⚡ Very fast   | Good quality
  small      ⚡ Fast        | Great quality  (default)
  medium     🔄 Moderate    | Excellent quality
  large-v3   🐢 Slow        | Best quality 👑

Examples:
  python process_video.py "https://youtu.be/..."
  python process_video.py "https://youtu.be/..." --model medium
  python process_video.py "https://youtu.be/..." --model large-v3
        """
    )
    parser.add_argument("url", help="Video URL (YouTube, TED, etc.)")
    parser.add_argument("--model", default="small", choices=MODELS_INFO.keys(),
                        help="Whisper model (default: small)")

    args = parser.parse_args()
    process_video(args.url, model_name=args.model)
