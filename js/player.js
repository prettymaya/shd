window.ShadowTED = window.ShadowTED || {};

ShadowTED.Player = {
    _video: null,
    _endTime: null,
    _isMonitoring: false,
    _playId: 0, // Cancellation token for overlapping play requests

    init() {
        this._video = document.getElementById('video-player');
        if (!this._video) return;

        this._video.addEventListener('timeupdate', () => this._onTimeUpdate());
    },

    loadVideo(src) {
        if (!this._video) return;
        this._playId++;
        this._video.src = src;
        this._video.load();
        this._endTime = null;
        this._isMonitoring = false;
        ShadowTED.State.isPlaying = false;
    },

    setPlaybackRate(rate) {
        if (this._video) {
            this._video.playbackRate = rate;
            this._video.defaultPlaybackRate = rate;
        }
    },

    async playSentence() {
        if (!this._video || !this._video.src) return;

        const state = ShadowTED.State;
        if (state.sentences.length === 0) return;

        const rawStartTime = state.currentGroupStartTime;
        const endTime = state.currentGroupEndTime;
        if (rawStartTime >= endTime) return;
        
        // Apply early start offset but don't go below 0
        const startTime = Math.max(0, rawStartTime - state.earlyStartOffset);

        // Cancel any previous play request
        const myId = ++this._playId;

        // Stop current playback
        this._isMonitoring = false;
        this._video.pause();

        // 1) Wait for metadata if not loaded yet
        if (this._video.readyState < 1) {
            await new Promise(resolve => {
                this._video.addEventListener('loadedmetadata', resolve, { once: true });
            });
            if (this._playId !== myId) return; // Cancelled
        }

        // 2) Seek to start time
        this._video.currentTime = startTime;

        // 3) Wait for seek to complete
        await new Promise(resolve => {
            this._video.addEventListener('seeked', resolve, { once: true });
        });
        if (this._playId !== myId) return; // Cancelled

        // 4) Verify we're at the right position (sanity check)
        const actual = this._video.currentTime;
        if (Math.abs(actual - startTime) > 1.0) {
            // Seek didn't work, try again
            this._video.currentTime = startTime;
            await new Promise(resolve => {
                this._video.addEventListener('seeked', resolve, { once: true });
            });
            if (this._playId !== myId) return;
        }

        // 5) Set end boundary, speed, and play
        this._endTime = endTime;
        this._isMonitoring = true;
        this.setPlaybackRate(state.playbackSpeed);
        this._video.play();

        state.isPlaying = true;
        state.emit('playbackStarted');

        const duration = (endTime - startTime) / state.playbackSpeed;
        ShadowTED.UI.setProgressDuration(duration);
    },

    _onTimeUpdate() {
        if (!this._isMonitoring || this._endTime === null) return;

        if (this._video.currentTime >= this._endTime - 0.08) {
            this._isMonitoring = false;
            this._video.pause();
            this._endTime = null;

            ShadowTED.State.isPlaying = false;
            ShadowTED.State.emit('playbackPaused');
        }
    },

    pause() {
        if (!this._video) return;
        this._playId++; // Cancel any pending async play
        this._isMonitoring = false;
        this._endTime = null;
        this._video.pause();
        ShadowTED.State.isPlaying = false;
        ShadowTED.State.emit('playbackPaused');
    }
};
