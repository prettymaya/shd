window.ShadowTED = window.ShadowTED || {};

ShadowTED.Gist = {
    _TOKEN_KEY: 'shadowted_github_token',
    _GIST_ID_KEY: 'shadowted_gist_id',

    init() {
        // Load saved token
        const tokenInput = document.getElementById('gist-token');
        const saved = localStorage.getItem(this._TOKEN_KEY);
        if (saved && tokenInput) {
            tokenInput.value = saved;
            tokenInput.type = 'password';
        }

        // Show saved Gist link if exists
        const gistId = localStorage.getItem(this._GIST_ID_KEY);
        if (gistId) {
            const urlInput = document.getElementById('gist-url-input');
            if (urlInput && !urlInput.value) {
                urlInput.value = `https://gist.github.com/${gistId}`;
                urlInput.style.color = '#888';
            }
        }

        // Save token button
        document.getElementById('gist-token-save')?.addEventListener('click', () => {
            const val = tokenInput?.value?.trim();
            if (val) {
                localStorage.setItem(this._TOKEN_KEY, val);
                this._toast('Token saved ✓');
            }
        });

        // Load from Gist
        document.getElementById('gist-load-btn')?.addEventListener('click', () => {
            const url = document.getElementById('gist-url-input')?.value?.trim();
            if (url) this.loadFromGist(url);
        });

        // Save to Gist
        document.getElementById('save-gist-btn')?.addEventListener('click', () => {
            this.saveToGist();
        });
    },

    _getToken() {
        return localStorage.getItem(this._TOKEN_KEY) || '';
    },

    _toast(msg) {
        let el = document.getElementById('gist-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gist-toast';
            el.className = 'gist-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 3000);
    },

    // ─── SAVE TO GIST (create or update) ─────────────

    async saveToGist() {
        const token = this._getToken();
        if (!token) {
            this._toast('❌ GitHub token required! Set it below the header.');
            return;
        }

        const state = ShadowTED.State;
        if (state.sentences.length === 0) {
            this._toast('❌ No session to save');
            return;
        }

        // Build transcript text
        const transcript = state.sentences.map(s => {
            const t = s.startTime;
            const h = Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            const sec = Math.floor(t % 60);
            const stamp = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
            return `${stamp}\n${s.text}`;
        }).join('\n\n');

        // Build config
        const config = {
            youtube_url: ShadowTED.App._youtubeUrl || '',
            title: document.querySelector('.tagline')?.textContent || 'ShadowTED Session',
            updated: new Date().toISOString(),
        };

        const files = {
            'transcript.txt': { content: transcript },
            'config.json': { content: JSON.stringify(config, null, 2) },
        };

        // Try to include video if local file exists and small enough
        const videoFile = ShadowTED.App._videoFile;
        if (videoFile && videoFile.size < 50 * 1024 * 1024) {
            this._toast('📤 Encoding video + transcript...');
            try {
                const videoBase64 = await this._fileToBase64(videoFile);
                files['video.mp4.base64'] = { content: videoBase64 };
            } catch (e) {
                console.warn('Could not encode video:', e);
            }
        } else if (videoFile && videoFile.size >= 50 * 1024 * 1024) {
            this._toast('📤 Video too large (>50MB), saving link + transcript...');
            // Delete old video file from Gist if it existed
            files['video.mp4.base64'] = null;
        } else {
            this._toast('📤 Saving to Gist...');
        }

        try {
            const existingGistId = localStorage.getItem(this._GIST_ID_KEY);

            let resp;
            if (existingGistId) {
                // UPDATE existing Gist (same link!)
                resp = await this._gistRequest('PATCH', `https://api.github.com/gists/${existingGistId}`, token, {
                    description: `ShadowTED | ${config.title}`,
                    files: files,
                });
            } else {
                // CREATE new Gist (first time only)
                resp = await this._gistRequest('POST', 'https://api.github.com/gists', token, {
                    description: `ShadowTED | ${config.title}`,
                    public: false,
                    files: files,
                });
            }

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));

                // If update failed (e.g. Gist was deleted), create new
                if (existingGistId && (resp.status === 404 || resp.status === 422)) {
                    localStorage.removeItem(this._GIST_ID_KEY);
                    return this.saveToGist(); // Retry as create
                }

                // Video too large → retry without video
                if (resp.status === 422 || (err.message && err.message.includes('too large'))) {
                    this._toast('⚠️ Video too large, retrying without video...');
                    delete files['video.mp4.base64'];
                    const method = existingGistId ? 'PATCH' : 'POST';
                    const url = existingGistId
                        ? `https://api.github.com/gists/${existingGistId}`
                        : 'https://api.github.com/gists';
                    const body = existingGistId
                        ? { description: `ShadowTED | ${config.title}`, files }
                        : { description: `ShadowTED | ${config.title}`, public: false, files };
                    const resp2 = await this._gistRequest(method, url, token, body);
                    if (!resp2.ok) throw new Error(`GitHub API: ${resp2.status}`);
                    const data2 = await resp2.json();
                    localStorage.setItem(this._GIST_ID_KEY, data2.id);
                    this._toast('✅ Saved (no video): ' + data2.html_url);
                    this._copyToClipboard(data2.html_url);
                    return;
                }

                throw new Error(err.message || `GitHub API: ${resp.status}`);
            }

            const data = await resp.json();
            localStorage.setItem(this._GIST_ID_KEY, data.id);

            if (existingGistId) {
                this._toast('✅ Updated! Same link.');
            } else {
                this._toast('✅ Saved! Link copied.');
                this._copyToClipboard(data.html_url);
            }

            // Update the Gist URL input
            const urlInput = document.getElementById('gist-url-input');
            if (urlInput) {
                urlInput.value = data.html_url;
                urlInput.style.color = '#888';
            }

        } catch (e) {
            this._toast('❌ Save failed: ' + e.message);
            console.error('Gist save error:', e);
        }
    },

    _gistRequest(method, url, token, body) {
        return fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    },

    // ─── LOAD FROM GIST ──────────────────────────────

    async loadFromGist(url) {
        this._toast('📥 Loading from Gist...');

        try {
            const gistId = this._extractGistId(url);
            if (!gistId) {
                this._toast('❌ Invalid Gist URL');
                return;
            }

            const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: { 'Accept': 'application/vnd.github+json' },
            });

            if (!resp.ok) throw new Error(`GitHub API: ${resp.status}`);
            const data = await resp.json();

            // Save this Gist ID for future updates
            localStorage.setItem(this._GIST_ID_KEY, gistId);

            // Get config
            let config = {};
            if (data.files['config.json']) {
                config = JSON.parse(data.files['config.json'].content);
            }

            // Get transcript
            const transcriptFile = data.files['transcript.txt'];
            if (!transcriptFile) {
                this._toast('❌ No transcript found in Gist');
                return;
            }

            let transcriptText = transcriptFile.content;
            if (transcriptFile.truncated && transcriptFile.raw_url) {
                const raw = await fetch(transcriptFile.raw_url);
                transcriptText = await raw.text();
            }

            // Check for video
            const videoFile = data.files['video.mp4.base64'];
            let videoBlob = null;
            if (videoFile) {
                this._toast('📥 Loading video from Gist...');
                let videoContent = videoFile.content;
                if (videoFile.truncated && videoFile.raw_url) {
                    const raw = await fetch(videoFile.raw_url);
                    videoContent = await raw.text();
                }
                videoBlob = this._base64ToBlob(videoContent, 'video/mp4');
            }

            // Set YouTube URL
            const ytInput = document.getElementById('youtube-url');
            if (config.youtube_url && ytInput) {
                ytInput.value = config.youtube_url;
                ytInput.dispatchEvent(new Event('input'));
            }

            // Set transcript in paste area
            const pasteInput = document.getElementById('paste-input');
            if (pasteInput) {
                pasteInput.value = transcriptText;
                pasteInput.dispatchEvent(new Event('input'));
            }

            // If video blob, create a virtual file
            if (videoBlob) {
                const file = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });
                ShadowTED.App._videoFile = file;
                ShadowTED.App._youtubeUrl = null;
                const card = document.getElementById('upload-video-card');
                if (card) {
                    card.classList.add('selected');
                    card.querySelector('.upload-title').textContent = 'Video from Gist';
                    card.querySelector('.upload-hint').textContent = this._formatSize(file.size);
                }
            }

            ShadowTED.App._checkReady();

            const hasVideo = !!(ShadowTED.App._videoFile || ShadowTED.App._youtubeUrl);
            const hasTranscript = !!(ShadowTED.App._txtFile || ShadowTED.App._pastedText);
            if (hasVideo && hasTranscript) {
                this._toast('✅ Loaded! Starting...');
                setTimeout(() => document.getElementById('start-btn')?.click(), 500);
            } else {
                this._toast('✅ Loaded from Gist');
            }

        } catch (e) {
            this._toast('❌ Load failed: ' + e.message);
            console.error('Gist load error:', e);
        }
    },

    // ─── HELPERS ─────────────────────────────────────

    _extractGistId(url) {
        if (!url) return null;
        const m = url.match(/([a-f0-9]{20,})/i);
        return m ? m[1] : null;
    },

    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    _base64ToBlob(base64, mimeType) {
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type: mimeType });
    },

    _copyToClipboard(text) {
        navigator.clipboard?.writeText(text).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    },

    _formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },
};
