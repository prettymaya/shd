#!/usr/bin/env python3
import sys
import os
import argparse
import yt_dlp
import whisper
import datetime
import traceback
import imageio_ffmpeg

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


def format_timestamp(seconds: float) -> str:
    """Formats float seconds into HH:MM:SS string."""
    td = datetime.timedelta(seconds=int(seconds))
    # format into HH:MM:SS
    total_seconds = int(td.total_seconds())
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
        'restrictfilenames': True,  # Keep filenames clean
        'noplaylist': True,
        'ffmpeg_location': BIN_DIR,
    }
    
    print(f"[*] Downloading video from: {url}")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info_dict)
        # yt-dlp might append ext differently if merging, so we ensure the path ends in .mp4
        if not filename.endswith('.mp4'):
            filename = os.path.splitext(filename)[0] + '.mp4'
        return filename

def process_video(url: str):
    os.makedirs("downloads", exist_ok=True)
    try:
        # 1. Download Video
        video_path = download_video(url, output_dir="downloads")
        print(f"[+] Video downloaded to: {video_path}")
        
        # 2. Transcribe Video using Whisper Large V3 Turbo
        print("[*] Loading Whisper Large V3 Turbo. This might take a moment if downloading the model for the first time...")
        # 'turbo' is the newly released openai-whisper large-v3-turbo model. 
        # Device is automatically selected (CPU, CUDA, MPS depending on platform).
        model = whisper.load_model("turbo")
        
        print("[*] Transcribing audio with sentence-level timestamps...")
        # We use the video directly, Whisper will extract the audio.
        result = model.transcribe(video_path, language="en", task="transcribe")
        
        segments = result.get('segments', [])
        
        if not segments:
            print("[-] No speech segments detected.")
            return

        # 3. Save formatted text file
        # Format expected by ShadowTED:
        # HH:MM:SS
        # Segment text here
        # <empty line>
        # HH:MM:SS...
        
        transcript_path = os.path.splitext(video_path)[0] + ".txt"
        print(f"[*] Saving transcript to: {transcript_path}")
        
        with open(transcript_path, "w", encoding="utf-8") as f:
            for seg in segments:
                start_time = seg['start']
                text = seg['text'].strip()
                
                # Exclude purely non-speech like (laughter) or [music] if needed, 
                # but let's keep it complete for now.
                
                # Format: 00:00:04
                stamp = format_timestamp(start_time)
                
                f.write(f"{stamp}\n")
                f.write(f"{text}\n\n")
                
        print(f"[+] Success! Files are ready in the 'downloads' folder.")
        print(f"[+] Video: {video_path}")
        print(f"[+] Text: {transcript_path}")
        print("[*] You can now drag and drop these two files into your ShadowTED website!")

    except Exception as e:
        print(f"[-] An error occurred: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and Transcribe YouTube/TED videos with Whisper Turbo.")
    parser.add_argument("url", help="URL of the YouTube or TED video")
    
    args = parser.parse_args()
    
    # Needs ffmpeg installed on the system (Mac: brew install ffmpeg)
    process_video(args.url)
