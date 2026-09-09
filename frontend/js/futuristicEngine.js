// Docholder CyberX —  Futuristic Sound Synthesizer, Holographic FX & HUD Engine

class DocholderAudioFX {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('docholder_sfx_enabled') !== 'false';
        this.initOnInteraction = this.initOnInteraction.bind(this);
        window.addEventListener('click',      this.initOnInteraction, { once: true });
        window.addEventListener('keydown',    this.initOnInteraction, { once: true });
        window.addEventListener('touchstart', this.initOnInteraction, { once: true });
    }

    // Deferred AudioContext —  only created after first real user gesture
    initContext() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        try {
            this.ctx = new AudioCtx();
        } catch(e) {}
    }

    initOnInteraction() {
        this.initContext();
        // If context was suspended by browser, resume it now
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('docholder_sfx_enabled', this.enabled ? 'true' : 'false');
        this.updateHeaderToggleIcons();
        if (this.enabled) {
            this.playSuccess();
        }
        return this.enabled;
    }

    updateHeaderToggleIcons() {
        document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = this.enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
            }
            btn.setAttribute('title', this.enabled ? 'Sound FX Enabled (Click to Mute)' : 'Sound FX Muted (Click to Unmute)');
            btn.style.color = this.enabled ? 'var(--cyan-neon)' : 'var(--text-muted)';
        });
    }

    // Synthesize crisp futuristic UI click blip
    playClick() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, now);
            osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.045);
        } catch (e) {}
    }

    // Synthesize soft hover tick
    playHover() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2200, now);
            osc.frequency.exponentialRampToValueAtTime(1600, now + 0.02);

            gain.gain.setValueAtTime(0.015, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.025);
        } catch (e) {}
    }

    // Synthesize futuristic laser scanning sweep (on dropzone hover/file select)
    playLaserScan() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(1450, now + 0.16);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(600, now);
            filter.frequency.linearRampToValueAtTime(2200, now + 0.16);
            filter.Q.value = 4.0;

            gain.gain.setValueAtTime(0.07, now);
            gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.19);
        } catch (e) {}
    }

    // Synthesize shimmering quantum success resolution chord
    playSuccess() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major Triad + Octave

            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const offset = idx * 0.04;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + offset);

                gain.gain.setValueAtTime(0, now + offset);
                gain.gain.linearRampToValueAtTime(0.06 / (idx + 1), now + offset + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.45);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + offset);
                osc.stop(now + offset + 0.5);
            });
        } catch (e) {}
    }

    // Synthesize cyber alert / warning buzz
    playAlert() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.setValueAtTime(190, now + 0.08);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        } catch (e) {}
    }

    // Synthesize mode warp transition sound
    playWarp() {
        if (!this.enabled) return;
        if (!this.ctx || this.ctx.state !== 'running') return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.13);
        } catch (e) {}
    }
}

// Global Cyber Audio Singleton
window.DocholderAudio = new DocholderAudioFX();

// Ambient Cyber Starfield & Particle Canvas for Desktop Background
class CyberStarfield {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.count = 42;
        this.mouse = { x: null, y: null };
        this.init();
    }

    init() {
        if (window.innerWidth <= 480) return; // Only on desktop backdrop
        
        let canvas = document.getElementById('ambient-cyber-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'ambient-cyber-canvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '0';
            canvas.style.opacity = '0.65';
            document.body.insertBefore(canvas, document.body.firstChild);
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        this.createParticles();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            this.particles.push({
                x: Math.random() * (this.canvas.width || window.innerWidth),
                y: Math.random() * (this.canvas.height || window.innerHeight),
                vx: (Math.random() - 0.5) * 0.45,
                vy: (Math.random() - 0.5) * 0.45,
                radius: Math.random() * 1.8 + 0.8,
                color: Math.random() > 0.4 ? 'rgba(0, 240, 255, ' : 'rgba(139, 92, 246, ',
                alpha: Math.random() * 0.5 + 0.25
            });
        }
    }

    animate() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color + p.alpha + ')';
            this.ctx.fill();

            // Connect nearby nodes
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 110) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.18 * (1 - dist / 110)})`;
                    this.ctx.lineWidth = 0.6;
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        requestAnimationFrame(this.animate);
    }
}

// Holographic 3D Card Tilt Engine
function initHoloTilt() {
    if (window.innerWidth <= 480) return;
    const cards = document.querySelectorAll('.glass-card, .stat-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const rotateX = -(y / (rect.height / 2)) * 3.5;
            const rotateY = (x / (rect.width / 2)) * 3.5;

            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });
}

// Attach Sci-Fi Audio to all Interactive Elements
function attachSciFiAudioListeners() {
    // Click sound on all buttons, chips, links, bottom nav
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.btn, .action-chip, .chip, .bottom-nav-item, .mobile-header-btn, .theme-toggle-btn, .sound-toggle-btn');
        if (target) {
            if (target.classList.contains('action-chip') || target.classList.contains('chip')) {
                window.DocholderAudio.playWarp();
            } else {
                window.DocholderAudio.playClick();
            }
        }
    });

    // Hover sound on buttons
    document.querySelectorAll('.btn, .action-chip, .chip, .bottom-nav-item').forEach(el => {
        el.addEventListener('mouseenter', () => window.DocholderAudio.playHover());
    });

    // Laser scan sound on dropzones
    document.querySelectorAll('.dropzone').forEach(dropzone => {
        dropzone.addEventListener('dragenter', () => window.DocholderAudio.playLaserScan());
        dropzone.addEventListener('click', () => window.DocholderAudio.playLaserScan());
    });
}

// Speech Synthesizer for AURA AI
window.CyberVoice = {
    speak(text) {
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = text.replace(/[*_#`]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.05;
            utterance.pitch = 1.15; // Slightly elevated cyber tone
            
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Natural') || v.name.includes('Zira')));
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }
            window.speechSynthesis.speak(utterance);
        } catch (e) {}
    }
};

// Auto-boot Futuristic Enhancements on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new CyberStarfield();
    initHoloTilt();
    attachSciFiAudioListeners();
    window.DocholderAudio.updateHeaderToggleIcons();

    // Inject sound toggle into mobile header if not already present
    const header = document.querySelector('.mobile-app-header > div:last-child');
    if (header && !document.querySelector('.sound-toggle-btn')) {
        const soundBtn = document.createElement('button');
        soundBtn.className = 'sound-toggle-btn mobile-header-btn';
        soundBtn.style.fontSize = '0.9rem';
        soundBtn.innerHTML = `<i class="${window.DocholderAudio.enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'}"></i>`;
        soundBtn.onclick = () => window.DocholderAudio.toggle();
        header.insertBefore(soundBtn, header.firstChild);
    }
});
