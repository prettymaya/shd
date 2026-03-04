window.ShadowTED = window.ShadowTED || {};

ShadowTED.UI = {
    els: {},

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
            header: document.getElementById('header'),
        };

        const state = ShadowTED.State;

        state.on('sentenceChanged', (data) => {
            this.updateActiveSentence(data.index, data.groupSize);
            this.updateCounter(data.index, state.totalSentences);
        });

        state.on('groupSizeChanged', (size) => {
            this.updateGroupDisplay(size);
            this.updateActiveSentence(state.currentIndex, size);
        });

        state.on('playbackStarted', () => {
            this.els.playerContainer?.classList.add('playing');
        });

        state.on('playbackPaused', () => {
            this.els.playerContainer?.classList.remove('playing');
            const active = this.els.sentenceList?.querySelector('.sentence-item.playing');
            if (active) active.classList.remove('playing');
        });
    },

    renderSentenceList(sentences) {
        const list = this.els.sentenceList;
        if (!list) return;

        list.innerHTML = '';
        const frag = document.createDocumentFragment();

        sentences.forEach((sent, i) => {
            const item = document.createElement('div');
            item.className = 'sentence-item';
            item.dataset.index = i;
            item.style.animationDelay = `${Math.min(i * 20, 500)}ms`;

            item.innerHTML = `
                <span class="sentence-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="sentence-text">${this._escapeHtml(sent.text)}</span>
                <span class="sentence-time">${this._formatTime(sent.startTime)}</span>
            `;

            item.addEventListener('click', () => {
                const state = ShadowTED.State;
                ShadowTED.Player.pause();
                state.currentIndex = i;
                state.emit('sentenceChanged', { index: i, groupSize: state.groupSize });
                setTimeout(() => ShadowTED.Player.playSentence(), 50);
            });

            frag.appendChild(item);
        });

        list.appendChild(frag);
        this.updateActiveSentence(0, ShadowTED.State.groupSize);
        this.updateCounter(0, sentences.length);
        this.updateGroupDisplay(ShadowTED.State.groupSize);
    },

    updateActiveSentence(index, groupSize) {
        const items = this.els.sentenceList?.querySelectorAll('.sentence-item');
        if (!items || items.length === 0) return;

        const groupEnd = Math.min(index + groupSize - 1, items.length - 1);

        items.forEach((item, i) => {
            item.classList.remove('active', 'in-group', 'past', 'playing');
            if (i < index) {
                item.classList.add('past');
            } else if (i === index) {
                item.classList.add('active');
            } else if (i <= groupEnd) {
                item.classList.add('in-group');
            }
        });

        if (items[index]) {
            items[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    setProgressDuration(duration) {
        const active = this.els.sentenceList?.querySelector('.sentence-item.active');
        if (active) {
            active.style.setProperty('--progress-duration', duration + 's');
            active.classList.add('playing');
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
