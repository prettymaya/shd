window.ShadowTED = window.ShadowTED || {};

ShadowTED.Recommendations = {
    _talks: [
        { title: "The Power of Vulnerability", speaker: "Brené Brown", id: "iCvmsMzlF7o", duration: "20:19" },
        { title: "Do Schools Kill Creativity?", speaker: "Sir Ken Robinson", id: "iG9CE55wbtY", duration: "19:22" },
        { title: "How Great Leaders Inspire Action", speaker: "Simon Sinek", id: "qp0HIF3SfI4", duration: "17:58" },
        { title: "Your Body Language May Shape Who You Are", speaker: "Amy Cuddy", id: "Ks-_Mh1QhMc", duration: "21:02" },
        { title: "The Puzzle of Motivation", speaker: "Dan Pink", id: "rrkrvAUbU9Y", duration: "18:36" },
        { title: "How to Speak So That People Want to Listen", speaker: "Julian Treasure", id: "eIho2S0ZahI", duration: "9:58" },
        { title: "The Happy Secret to Better Work", speaker: "Shawn Achor", id: "fLJsdqxnZb0", duration: "12:20" },
        { title: "Grit: The Power of Passion and Perseverance", speaker: "Angela Lee Duckworth", id: "H14bBuluwB8", duration: "6:12" },
        { title: "The Skill of Self Confidence", speaker: "Dr. Ivan Joseph", id: "w-HYZv6HzAs", duration: "13:20" },
        { title: "Try Something New for 30 Days", speaker: "Matt Cutts", id: "UNP03fDSj1U", duration: "3:27" },
        { title: "The Power of Introverts", speaker: "Susan Cain", id: "c0KYU2j0TM4", duration: "19:04" },
        { title: "Inside the Mind of a Master Procrastinator", speaker: "Tim Urban", id: "arj7oStGLkU", duration: "14:03" },
        { title: "What Makes a Good Life?", speaker: "Robert Waldinger", id: "8KkKuTCFvzI", duration: "12:46" },
        { title: "The Danger of a Single Story", speaker: "Chimamanda Ngozi Adichie", id: "D9Ihs241zeg", duration: "18:33" },
        { title: "How to Make Stress Your Friend", speaker: "Kelly McGonigal", id: "RcGyVTAoXEU", duration: "14:28" },
        { title: "10 Ways to Have a Better Conversation", speaker: "Celeste Headlee", id: "R1vskiVDwl4", duration: "11:44" },
        { title: "The Art of Misdirection", speaker: "Apollo Robbins", id: "GZGY0wPAnus", duration: "8:50" },
        { title: "My Philosophy for a Happy Life", speaker: "Sam Berns", id: "36m1o-tM05g", duration: "12:44" },
        { title: "The Power of Believing That You Can Improve", speaker: "Carol Dweck", id: "_X0mgOOSpLU", duration: "10:20" },
        { title: "Sleep Is Your Superpower", speaker: "Matt Walker", id: "5MuIMqhT8DM", duration: "19:18" },
        { title: "How to Stop Screwing Yourself Over", speaker: "Mel Robbins", id: "Lp7E973zozc", duration: "21:39" },
        { title: "The Habits of Personal Accountability", speaker: "Sam Silverstein", id: "dIYmzf21d1g", duration: "11:22" },
        { title: "Every Kid Needs a Champion", speaker: "Rita Pierson", id: "SFnMTHhKdkw", duration: "7:48" },
        { title: "Your Elusive Creative Genius", speaker: "Elizabeth Gilbert", id: "86x-u-tz0MA", duration: "19:29" },
        { title: "The Transformative Power of Classical Music", speaker: "Benjamin Zander", id: "r9LCwI5iErE", duration: "20:43" },
        { title: "How to Fix a Broken Heart", speaker: "Guy Winch", id: "k0GQSJrpVhM", duration: "12:17" },
        { title: "What I Learned from 100 Days of Rejection", speaker: "Jia Jiang", id: "-vZXgApsPCQ", duration: "15:28" },
        { title: "The Magic of Not Giving a F***", speaker: "Sarah Knight", id: "GwRzjFQa_Og", duration: "12:07" },
        { title: "5 Ways to Listen Better", speaker: "Julian Treasure", id: "cSohjlYQI2A", duration: "7:51" },
        { title: "Why We All Need to Practice Emotional First Aid", speaker: "Guy Winch", id: "F2hc2FLOdhI", duration: "17:24" },
        { title: "The Power of Passion and Perseverance", speaker: "Angela Duckworth", id: "H14bBuluwB8", duration: "6:12" },
        { title: "Looks Aren't Everything", speaker: "Cameron Russell", id: "KM4Xe6Dlp0Y", duration: "9:37" },
        { title: "How to Gain Control of Your Free Time", speaker: "Laura Vanderkam", id: "n3kNlFMXslo", duration: "11:53" },
        { title: "What Adults Can Learn from Kids", speaker: "Adora Svitak", id: "V-bjOJzB7LY", duration: "8:12" },
        { title: "The Secret to Living Longer May Be Your Social Life", speaker: "Susan Pinker", id: "ptIecdCZ3dg", duration: "16:06" },
    ],

    _panel: null,
    _overlay: null,

    init() {
        const btn = document.getElementById('recommend-btn');
        btn?.addEventListener('click', () => this.toggle());
    },

    toggle() {
        if (this._panel && !this._panel.classList.contains('hidden')) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        if (!this._panel) this._createPanel();

        this._loadRandom();
        this._panel.classList.remove('hidden');
        this._overlay.classList.remove('hidden');
        setTimeout(() => {
            this._panel.classList.add('open');
            this._overlay.classList.add('open');
        }, 10);
    },

    close() {
        if (!this._panel) return;
        this._panel.classList.remove('open');
        this._overlay.classList.remove('open');
        setTimeout(() => {
            this._panel.classList.add('hidden');
            this._overlay.classList.add('hidden');
        }, 300);
    },

    _createPanel() {
        // Overlay
        this._overlay = document.createElement('div');
        this._overlay.className = 'reco-overlay hidden';
        this._overlay.addEventListener('click', () => this.close());
        document.body.appendChild(this._overlay);

        // Panel
        this._panel = document.createElement('div');
        this._panel.className = 'reco-panel hidden';
        this._panel.innerHTML = `
            <div class="reco-header">
                <h2 class="reco-title">🎤 Recommended TED Talks</h2>
                <button class="reco-close" aria-label="Close">✕</button>
            </div>
            <p class="reco-subtitle">Tap a talk to copy its YouTube URL</p>
            <div class="reco-list" id="reco-list"></div>
            <button class="reco-refresh" id="reco-refresh">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
                Show 5 More
            </button>
            <div class="reco-toast hidden" id="reco-toast">✓ URL copied!</div>
        `;
        document.body.appendChild(this._panel);

        this._panel.querySelector('.reco-close').addEventListener('click', () => this.close());
        document.getElementById('reco-refresh').addEventListener('click', () => this._loadRandom());
    },

    _loadRandom() {
        const list = document.getElementById('reco-list');
        if (!list) return;

        // Pick 5 random talks
        const shuffled = [...this._talks].sort(() => Math.random() - 0.5);
        const picks = shuffled.slice(0, 5);

        list.innerHTML = '';
        picks.forEach((talk, i) => {
            const item = document.createElement('div');
            item.className = 'reco-item';
            item.style.animationDelay = `${i * 60}ms`;
            item.innerHTML = `
                <div class="reco-thumb">
                    <img src="https://img.youtube.com/vi/${talk.id}/mqdefault.jpg" alt="" loading="lazy">
                    <span class="reco-duration">${talk.duration}</span>
                </div>
                <div class="reco-info">
                    <span class="reco-talk-title">${talk.title}</span>
                    <span class="reco-speaker">${talk.speaker}</span>
                </div>
            `;
            item.addEventListener('click', () => this._copyUrl(talk));
            list.appendChild(item);
        });
    },

    async _copyUrl(talk) {
        const url = `https://www.youtube.com/watch?v=${talk.id}`;
        try {
            await navigator.clipboard.writeText(url);
            this._showToast();
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this._showToast();
        }
    },

    _showToast() {
        const toast = document.getElementById('reco-toast');
        if (!toast) return;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 1500);
    }
};

document.addEventListener('DOMContentLoaded', () => ShadowTED.Recommendations.init());
