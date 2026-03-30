window.ShadowTED = window.ShadowTED || {};

ShadowTED.State = (function () {
    const _listeners = {};

    return {
        videoId: null,
        sentences: [],
        currentIndex: 0,
        groupSize: 1,
        playbackSpeed: 1.0,
        earlyStartOffset: 0,
        isPlaying: false,
        isLoading: false,
        error: null,

        on(event, fn) {
            if (!_listeners[event]) _listeners[event] = [];
            _listeners[event].push(fn);
        },

        emit(event, data) {
            (_listeners[event] || []).forEach(fn => fn(data));
        },

        get currentSentence() {
            return this.sentences[this.currentIndex] || null;
        },

        get currentGroupEndIndex() {
            return Math.min(this.currentIndex + this.groupSize - 1, this.sentences.length - 1);
        },

        get currentGroupStartTime() {
            return this.sentences[this.currentIndex]?.startTime ?? 0;
        },

        get currentGroupEndTime() {
            return this.sentences[this.currentGroupEndIndex]?.endTime ?? 0;
        },

        get totalSentences() {
            return this.sentences.length;
        },

        reset() {
            this.videoId = null;
            this.sentences = [];
            this.currentIndex = 0;
            this.groupSize = 1;
            this.playbackSpeed = parseFloat(document.getElementById('speed-setting')?.value || '1.0');
            this.earlyStartOffset = parseFloat(document.getElementById('early-start-setting')?.value || '0');
            this.isPlaying = false;
            this.isLoading = false;
            this.error = null;
        }
    };
})();
