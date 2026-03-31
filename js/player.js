window.ShadowTED = window.ShadowTED || {};

ShadowTED.Player = {
    _video: null,       // HTML5 <video> element
    _ytPlayer: null,    // YouTube IFrame player
    _mode: 'local',     // 'local' or 'youtube'
    _endTime: null,
    _isMonitoring: false,
    _playId: 0,
    _ytReady: false,
    _ytReadyResolve: null,
    _ytMonitorInterval: null,

    init() {
        this._video = document.getElementById('video-player');
        if (this._video) {
            this._video.addEventListener('timeupdate', () => this._onTimeUpdate());
        }
    },

    // ── Local Video ─────────────────────────────────
    loadVideo(src) {
        this._mode = 'local';
        this._playId++;
        this._stopYTMonitor();

        // Show local, hide YT
        if (this._video) {
            this._video.classList.remove('hidden');
            this._video.src = src;
            this._video.load();
        }
        document.getElementById('youtube-player-wrap')?.classList.add('hidden');

        this._endTime = null;
        this._isMonitoring = false;
        ShadowTED.State.isPlaying = false;
    },

    // ── YouTube Video ───────────────────────────────
    loadYouTube(videoId) {
        this._mode = 'youtube';
        this._playId++;
        this._ytReady = false;

        // Hide local, show YT
        if (this._video) this._video.classList.add('hidden');
        const wrap = document.getElementById('youtube-player-wrap');
        wrap?.classList.remove('hidden');

        // Destroy old player if exists
        if (this._ytPlayer) {
            this._ytPlayer.destroy();
            this._ytPlayer = null;
            // Re-create the div (YouTube API removes it on destroy)
            const div = document.createElement('div');
            div.id = 'youtube-player';
            wrap.innerHTML = '';
            wrap.appendChild(div);
        }

        // Create YouTube IFrame Player
        const self = this;
        this._ytPlayer = new YT.Player('youtube-player', {
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                disablekb: 1,
                fs: 0,
            },
            events: {
                onReady() {
                    self._ytReady = true;
                    if (self._ytReadyResolve) {
                        self._ytReadyResolve();
                        self._ytReadyResolve = null;
                    }
                }
            }
        });

        this._endTime = null;
        this._isMonitoring = false;
        ShadowTED.State.isPlaying = false;
    },

    _waitYTReady() {
        if (this._ytReady) return Promise.resolve();
        return new Promise(resolve => { this._ytReadyResolve = resolve; });
    },

    // ── Playback Rate (works for both) ──────────────
    setPlaybackRate(rate) {
        if (this._mode === 'youtube' && this._ytPlayer?.setPlaybackRate) {
            this._ytPlayer.setPlaybackRate(rate);
        } else if (this._video) {
            this._video.playbackRate = rate;
            this._video.defaultPlaybackRate = rate;
        }
    },

    // ── Play Sentence (unified for both modes) ──────
    async playSentence() {
        const state = ShadowTED.State;
        if (state.sentences.length === 0) return;

        const rawStartTime = state.currentGroupStartTime;
        const endTime = state.currentGroupEndTime;
        if (rawStartTime >= endTime) return;

        const startTime = Math.max(0, rawStartTime - state.earlyStartOffset);
        const myId = ++this._playId;

        // Stop current playback
        this._isMonitoring = false;
        this._stopYTMonitor();

        if (this._mode === 'youtube') {
            await this._playSentenceYT(startTime, endTime, myId, state);
        } else {
            await this._playSentenceLocal(startTime, endTime, myId, state);
        }
    },

    // ── Local play logic ────────────────────────────
    async _playSentenceLocal(startTime, endTime, myId, state) {
        if (!this._video || !this._video.src) return;

        this._video.pause();

        // Wait for metadata
        if (this._video.readyState < 1) {
            await new Promise(resolve => {
                this._video.addEventListener('loadedmetadata', resolve, { once: true });
            });
            if (this._playId !== myId) return;
        }

        // Seek
        this._video.currentTime = startTime;
        await new Promise(resolve => {
            this._video.addEventListener('seeked', resolve, { once: true });
        });
        if (this._playId !== myId) return;

        // Verify seek
        if (Math.abs(this._video.currentTime - startTime) > 1.0) {
            this._video.currentTime = startTime;
            await new Promise(resolve => {
                this._video.addEventListener('seeked', resolve, { once: true });
            });
            if (this._playId !== myId) return;
        }

        // Play
        this._endTime = endTime;
        this._isMonitoring = true;
        this.setPlaybackRate(state.playbackSpeed);
        this._video.play();

        state.isPlaying = true;
        state.emit('playbackStarted');
        ShadowTED.UI.setProgressDuration((endTime - startTime) / state.playbackSpeed);
    },

    // ── YouTube play logic ──────────────────────────
    async _playSentenceYT(startTime, endTime, myId, state) {
        if (!this._ytPlayer) return;
        await this._waitYTReady();
        if (this._playId !== myId) return;

        this._ytPlayer.pauseVideo();

        // Set speed and seek
        this.setPlaybackRate(state.playbackSpeed);
        this._ytPlayer.seekTo(startTime, true);

        // Short delay to let seek settle
        await new Promise(r => setTimeout(r, 200));
        if (this._playId !== myId) return;

        // Play
        this._endTime = endTime;
        this._isMonitoring = true;
        this._ytPlayer.playVideo();

        state.isPlaying = true;
        state.emit('playbackStarted');
        ShadowTED.UI.setProgressDuration((endTime - startTime) / state.playbackSpeed);

        // Start monitoring with interval (YT has no timeupdate event)
        this._startYTMonitor(myId);
    },

    _startYTMonitor(myId) {
        this._stopYTMonitor();
        this._ytMonitorInterval = setInterval(() => {
            if (this._playId !== myId || !this._isMonitoring) {
                this._stopYTMonitor();
                return;
            }
            this._onTimeUpdateYT();
        }, 80);
    },

    _stopYTMonitor() {
        if (this._ytMonitorInterval) {
            clearInterval(this._ytMonitorInterval);
            this._ytMonitorInterval = null;
        }
    },

    // ── Time monitoring ─────────────────────────────
    _onTimeUpdate() {
        if (this._mode !== 'local' || !this._isMonitoring || this._endTime === null) return;

        if (this._video.currentTime >= this._endTime - 0.08) {
            this._isMonitoring = false;
            this._video.pause();
            this._endTime = null;
            ShadowTED.State.isPlaying = false;
            ShadowTED.State.emit('playbackPaused');
        }
    },

    _onTimeUpdateYT() {
        if (!this._isMonitoring || this._endTime === null || !this._ytPlayer) return;

        const currentTime = this._ytPlayer.getCurrentTime();
        if (currentTime >= this._endTime - 0.15) {
            this._isMonitoring = false;
            this._ytPlayer.pauseVideo();
            this._endTime = null;
            this._stopYTMonitor();
            ShadowTED.State.isPlaying = false;
            ShadowTED.State.emit('playbackPaused');
        }
    },

    // ── Pause (works for both) ──────────────────────
    pause() {
        this._playId++;
        this._isMonitoring = false;
        this._endTime = null;
        this._stopYTMonitor();

        if (this._mode === 'youtube' && this._ytPlayer?.pauseVideo) {
            this._ytPlayer.pauseVideo();
        } else if (this._video) {
            this._video.pause();
        }

        ShadowTED.State.isPlaying = false;
        ShadowTED.State.emit('playbackPaused');
    }
};
