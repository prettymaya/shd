window.ShadowTED = window.ShadowTED || {};

ShadowTED.App = {
    _videoFile: null,
    _txtFile: null,
    _pastedText: null,

    init() {
        ShadowTED.Player.init();
        ShadowTED.UI.init();
        ShadowTED.Keyboard.init();

        const videoInput = document.getElementById('video-file');
        const txtInput = document.getElementById('txt-file');
        const pasteInput = document.getElementById('paste-input');
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
            videoCard.classList.add('selected');
            videoCard.querySelector('.upload-title').textContent = file.name;
            videoCard.querySelector('.upload-hint').textContent = this._formatSize(file.size);
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
    },

    _checkReady() {
        const btn = document.getElementById('start-btn');
        const hasVideo = !!this._videoFile;
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

            if (!this._videoFile) return;

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

            // Load video from file
            const videoUrl = URL.createObjectURL(this._videoFile);
            ShadowTED.Player.loadVideo(videoUrl);

            // Show workspace
            ShadowTED.UI.showWorkspace(this._videoFile.name.replace(/\.[^.]+$/, ''));
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
