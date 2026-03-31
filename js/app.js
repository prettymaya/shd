window.ShadowTED = window.ShadowTED || {};

ShadowTED.App = {
    _videoFile: null,
    _youtubeUrl: null,
    _txtFile: null,
    _pastedText: null,

    init() {
        ShadowTED.Player.init();
        ShadowTED.UI.init();
        ShadowTED.Keyboard.init();

        const videoInput = document.getElementById('video-file');
        const txtInput = document.getElementById('txt-file');
        const pasteInput = document.getElementById('paste-input');
        const ytInput = document.getElementById('youtube-url');
        const videoCard = document.getElementById('upload-video-card');
        const txtCard = document.getElementById('upload-txt-card');
        const startBtn = document.getElementById('start-btn');
        const backBtn = document.getElementById('back-btn');

        // Click cards to trigger file inputs
        videoCard?.addEventListener('click', () => videoInput?.click());
        txtCard?.addEventListener('click', () => txtInput?.click());

        // Video selected
        videoInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this._videoFile = file;
            this._youtubeUrl = null;
            if (ytInput) ytInput.value = '';
            videoCard.classList.add('selected');
            videoCard.querySelector('.upload-title').textContent = file.name;
            videoCard.querySelector('.upload-hint').textContent = this._formatSize(file.size);
            this._checkReady();
        });

        // YouTube URL entered
        ytInput?.addEventListener('input', () => {
            const val = (ytInput.value || '').trim();
            const ytId = this._extractYouTubeId(val);
            if (ytId) {
                this._youtubeUrl = val;
                this._videoFile = null;
                videoCard.classList.add('selected');
                videoCard.querySelector('.upload-title').textContent = 'YouTube Video';
                videoCard.querySelector('.upload-hint').textContent = ytId;
            } else {
                this._youtubeUrl = null;
                if (!this._videoFile) {
                    videoCard.classList.remove('selected');
                    videoCard.querySelector('.upload-title').textContent = 'Upload Video / Audio';
                    videoCard.querySelector('.upload-hint').textContent = 'MP4 or MP3 file';
                }
            }
            this._checkReady();
        });

        // TXT selected
        txtInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this._txtFile = file;
            this._pastedText = null; // Clear paste if file selected
            if (pasteInput) pasteInput.value = '';
            txtCard.classList.add('selected');
            txtCard.querySelector('.upload-title').textContent = file.name;
            txtCard.querySelector('.upload-hint').textContent = this._formatSize(file.size);
            this._checkReady();
        });

        // Paste input
        pasteInput?.addEventListener('input', () => {
            const val = pasteInput.value.trim();
            if (val.length > 10) {
                this._pastedText = val;
                this._txtFile = null; // Clear file if pasting
                txtCard.classList.add('selected');
                txtCard.querySelector('.upload-title').textContent = 'Pasted transcript';
                txtCard.querySelector('.upload-hint').textContent = `${val.split('\n').length} lines`;
            } else {
                this._pastedText = null;
                if (!this._txtFile) {
                    txtCard.classList.remove('selected');
                    txtCard.querySelector('.upload-title').textContent = 'Upload Transcript (.txt)';
                    txtCard.querySelector('.upload-hint').textContent = 'or paste below ↓';
                }
            }
            this._checkReady();
        });

        // Start
        startBtn?.addEventListener('click', () => this._start());

        // Back
        backBtn?.addEventListener('click', () => this._backToUpload());

        // Toggle video
        document.getElementById('toggle-video-btn')?.addEventListener('click', () => {
            const panel = document.getElementById('player-panel');
            const text = document.getElementById('toggle-video-text');
            const ws = document.getElementById('workspace');
            if (panel) {
                const hiding = !panel.classList.contains('hidden');
                panel.classList.toggle('hidden');
                ws?.classList.toggle('video-hidden', hiding);
                if (text) text.textContent = hiding ? 'Show Video' : 'Hide Video';
            }
        });

        // Group size buttons
        document.getElementById('group-dec')?.addEventListener('click', () => {
            ShadowTED.Keyboard._changeGroupSize(-1);
        });
        document.getElementById('group-inc')?.addEventListener('click', () => {
            ShadowTED.Keyboard._changeGroupSize(1);
        });

        // Playback Settings
        document.getElementById('speed-setting')?.addEventListener('change', (e) => {
            const speed = parseFloat(e.target.value);
            ShadowTED.State.playbackSpeed = speed;
            if (ShadowTED.Player._video) {
                ShadowTED.Player.setPlaybackRate(speed);
            }
        });
        
        document.getElementById('early-start-setting')?.addEventListener('change', (e) => {
            ShadowTED.State.earlyStartOffset = parseFloat(e.target.value);
        });
    },

    _checkReady() {
        const btn = document.getElementById('start-btn');
        const hasVideo = !!(this._videoFile || this._youtubeUrl);
        const hasTranscript = !!(this._txtFile || this._pastedText);
        if (btn) btn.disabled = !(hasVideo && hasTranscript);
    },

    async _start() {
        const feedback = document.getElementById('upload-feedback');

        try {
            // Get transcript text
            let text;
            if (this._txtFile) {
                text = await this._txtFile.text();
            } else if (this._pastedText) {
                text = this._pastedText;
            } else {
                return;
            }

            if (!this._videoFile && !this._youtubeUrl) return;

            const sentences = this._parseTranscript(text);

            if (sentences.length === 0) {
                feedback.textContent = '❌ No sentences found. Check the format: timestamp, text, blank line.';
                feedback.className = 'upload-feedback error';
                feedback.classList.remove('hidden');
                return;
            }

            // Reset state
            ShadowTED.State.reset();
            ShadowTED.State.sentences = sentences;

            // Load video: YouTube or local file
            let title;
            if (this._youtubeUrl) {
                const ytId = this._extractYouTubeId(this._youtubeUrl);
                ShadowTED.Player.loadYouTube(ytId);
                title = 'YouTube - ' + ytId;
            } else {
                const videoUrl = URL.createObjectURL(this._videoFile);
                ShadowTED.Player.loadVideo(videoUrl);
                title = this._videoFile.name.replace(/\.[^.]+$/, '');
            }

            // Show workspace
            ShadowTED.UI.showWorkspace(title);
            ShadowTED.UI.renderSentenceList(sentences);
            ShadowTED.State.emit('sentenceChanged', {
                index: 0,
                groupSize: ShadowTED.State.groupSize,
            });

        } catch (err) {
            feedback.textContent = '❌ Error: ' + err.message;
            feedback.className = 'upload-feedback error';
            feedback.classList.remove('hidden');
        }
    },

    _parseTranscript(text) {
        const lines = text.split('\n');
        const timeRe = /^(\d{1,2}:)?\d{2}:\d{2}$/;
        const raw = [];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            if (timeRe.test(line)) {
                const time = this._parseTime(line);
                const textLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
                if (textLine) {
                    raw.push({ time, text: textLine });
                }
                i += 2;
            } else {
                i++;
            }

            while (i < lines.length && lines[i].trim() === '') i++;
        }

        if (raw.length === 0) return [];

        const sentences = [];
        for (let j = 0; j < raw.length; j++) {
            const endTime = (j + 1 < raw.length) ? raw[j + 1].time : raw[j].time + 5;
            sentences.push({
                index: j,
                text: raw[j].text,
                startTime: raw[j].time,
                endTime: endTime,
            });
        }

        return sentences;
    },

    _parseTime(str) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    },

    _extractYouTubeId(url) {
        if (!url) return null;
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /^([a-zA-Z0-9_-]{11})$/,
        ];
        for (const p of patterns) {
            const m = url.match(p);
            if (m) return m[1];
        }
        return null;
    },

    _backToUpload() {
        ShadowTED.Player.pause();
        ShadowTED.UI.hideWorkspace();
    },

    _formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
};

document.addEventListener('DOMContentLoaded', () => ShadowTED.App.init());
