window.ShadowTED = window.ShadowTED || {};

ShadowTED.UI = {
    els: {},
    _allSentences: [],

    init() {
        this.els = {
            workspace: document.getElementById('workspace'),
            sentenceList: document.getElementById('sentence-list'),
            sentenceCounter: document.getElementById('sentence-counter'),
            groupSizeDisplay: document.getElementById('group-size-display'),
            groupIndicator: document.getElementById('group-indicator'),
            shortcutBar: document.getElementById('shortcut-bar'),
            touchControls: document.getElementById('touch-controls'),
            playerContainer: document.getElementById('player-container'),
            groupDec: document.getElementById('group-dec'),
            groupInc: document.getElementById('group-inc'),
            uploadSection: document.getElementById('upload-section'),
            resourcesSection: document.getElementById('resources-section'),
            heroSection: document.getElementById('hero-section'),
            header: document.getElementById('header'),
        };

        const state = ShadowTED.State;

        state.on('sentenceChanged', (data) => {
            this._renderFocused(data.index, data.groupSize);
            this.updateCounter(data.index, state.totalSentences);
        });

        state.on('groupSizeChanged', (size) => {
            this.updateGroupDisplay(size);
            this._renderFocused(state.currentIndex, size);
        });

        state.on('playbackStarted', () => {
            this.els.playerContainer?.classList.add('playing');
            const active = this.els.sentenceList?.querySelector('.focused-active');
            if (active) active.classList.add('playing');
        });

        state.on('playbackPaused', () => {
            this.els.playerContainer?.classList.remove('playing');
            const playing = this.els.sentenceList?.querySelector('.playing');
            if (playing) playing.classList.remove('playing');
        });
    },

    renderSentenceList(sentences) {
        this._allSentences = sentences;
        this.updateGroupDisplay(ShadowTED.State.groupSize);
    },

    /** Render only the active group + 1 next sentence */
    _renderFocused(index, groupSize) {
        const list = this.els.sentenceList;
        if (!list || this._allSentences.length === 0) return;

        list.innerHTML = '';

        const groupEnd = Math.min(index + groupSize - 1, this._allSentences.length - 1);

        // Render active group sentences
        for (let i = index; i <= groupEnd; i++) {
            const sent = this._allSentences[i];
            const el = this._createSentenceEl(sent, i, 'focused-active');
            list.appendChild(el);
        }

        // Render 1 next sentence as preview
        const nextIdx = groupEnd + 1;
        if (nextIdx < this._allSentences.length) {
            const sent = this._allSentences[nextIdx];
            const el = this._createSentenceEl(sent, nextIdx, 'focused-next');
            list.appendChild(el);
        }
    },

    _createSentenceEl(sent, i, cls) {
        const el = document.createElement('div');
        el.className = `focused-sentence ${cls}`;
        el.innerHTML = `
            <span class="focused-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="focused-text">${this._escapeHtml(sent.text)}</span>
            <span class="focused-time">${this._formatTime(sent.startTime)}</span>
        `;
        // Click to play
        el.addEventListener('click', () => {
            const state = ShadowTED.State;
            ShadowTED.Player.pause();
            state.currentIndex = i;
            state.emit('sentenceChanged', { index: i, groupSize: state.groupSize });
            setTimeout(() => ShadowTED.Player.playSentence(), 50);
        });
        return el;
    },

    setProgressDuration(duration) {
        const active = this.els.sentenceList?.querySelector('.focused-active');
        if (active) {
            active.style.setProperty('--progress-duration', duration + 's');
        }
    },

    updateCounter(index, total) {
        const el = this.els.sentenceCounter;
        if (!el) return;
        el.textContent = `${index + 1} / ${total}`;
        el.classList.remove('bounce');
        void el.offsetWidth;
        el.classList.add('bounce');
    },

    updateGroupDisplay(size) {
        if (this.els.groupSizeDisplay) this.els.groupSizeDisplay.textContent = size;
        if (this.els.groupIndicator) this.els.groupIndicator.textContent = size > 1 ? `${size} sentences` : '';
        if (this.els.groupDec) this.els.groupDec.disabled = size <= 1;
    },

    showWorkspace(title) {
        if (this.els.uploadSection) this.els.uploadSection.classList.add('hidden');
        if (this.els.resourcesSection) this.els.resourcesSection.classList.add('hidden');
        if (this.els.heroSection) this.els.heroSection.classList.add('hidden');

        const ws = this.els.workspace;
        if (ws) {
            ws.classList.remove('hidden');
            ws.classList.add('entering');
            setTimeout(() => ws.classList.remove('entering'), 600);
        }
        this.els.shortcutBar?.classList.remove('hidden');
        this.els.touchControls?.classList.remove('hidden');
        document.body.classList.add('workspace-active');

        const tagline = document.querySelector('.tagline');
        if (tagline && title) tagline.textContent = title;
    },

    hideWorkspace() {
        if (this.els.uploadSection) this.els.uploadSection.classList.remove('hidden');
        if (this.els.resourcesSection) this.els.resourcesSection.classList.remove('hidden');
        if (this.els.heroSection) this.els.heroSection.classList.remove('hidden');
        if (this.els.workspace) this.els.workspace.classList.add('hidden');
        this.els.shortcutBar?.classList.add('hidden');
        this.els.touchControls?.classList.add('hidden');
        document.body.classList.remove('workspace-active');

        const tagline = document.querySelector('.tagline');
        if (tagline) tagline.textContent = 'Master any TED Talk, one sentence at a time';
    },

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
