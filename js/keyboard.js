window.ShadowTED = window.ShadowTED || {};

ShadowTED.Keyboard = {
    init() {
        document.addEventListener('keydown', (e) => this._handleKeydown(e));
        this._bindTouchControls();
    },

    _handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                this._replayCurrent();
                break;
            case 's':
                e.preventDefault();
                this._playCurrent();
                break;
            case 'r':
                e.preventDefault();
                this._playCurrent();
                break;
            case 'n':
                e.preventDefault();
                this._nextSentence();
                break;
            case 'a':
                e.preventDefault();
                this._prevSentence();
                break;
            case '+':
            case '=':
                e.preventDefault();
                this._changeGroupSize(1);
                break;
            case '-':
                e.preventDefault();
                this._changeGroupSize(-1);
                break;
        }
    },

    _playCurrent() {
        if (ShadowTED.State.sentences.length === 0) return;
        ShadowTED.Player.playSentence();
    },

    _replayCurrent() {
        if (ShadowTED.State.sentences.length === 0) return;
        // Force stop and immediately replay — no delay
        ShadowTED.Player.pause();
        ShadowTED.Player.playSentence();
    },

    _nextSentence() {
        const state = ShadowTED.State;
        if (state.sentences.length === 0) return;

        // Stop any current playback
        ShadowTED.Player.pause();

        const next = state.currentIndex + state.groupSize;
        if (next < state.totalSentences) {
            state.currentIndex = next;
        }
        // If we're at the end, stay at current (don't wrap)
        state.emit('sentenceChanged', { index: state.currentIndex, groupSize: state.groupSize });
    },

    _prevSentence() {
        const state = ShadowTED.State;
        if (state.sentences.length === 0) return;

        ShadowTED.Player.pause();

        const prev = state.currentIndex - state.groupSize;
        state.currentIndex = Math.max(prev, 0);
        state.emit('sentenceChanged', { index: state.currentIndex, groupSize: state.groupSize });
    },

    _changeGroupSize(delta) {
        const state = ShadowTED.State;
        const newSize = Math.max(1, Math.min(10, state.groupSize + delta));
        if (newSize !== state.groupSize) {
            state.groupSize = newSize;
            state.emit('groupSizeChanged', newSize);
        }
    },

    _bindTouchControls() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        bind('touch-prev', () => this._prevSentence());
        bind('touch-play', () => this._playCurrent());
        bind('touch-replay', () => this._playCurrent());
        bind('touch-next', () => this._nextSentence());
    }
};
