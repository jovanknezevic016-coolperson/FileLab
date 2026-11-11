// FileLab 1.1 - Sound Engine

const FileLabSounds = {
    audio: null,
    enabled: true,
    volume: 0.2,

    init() {
        if (!this.audio) {
            this.audio = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.audio.state === "suspended") {
            this.audio.resume();
        }
    },

    play(frequency, duration = 0.08) {
        if (!this.enabled) return;

        this.init();

        const oscillator = this.audio.createOscillator();
        const gain = this.audio.createGain();

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(this.volume, this.audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            this.audio.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(this.audio.destination);

        oscillator.start();
        oscillator.stop(this.audio.currentTime + duration);
    },

    click() {
        this.play(650, 0.06);
    },

    success() {
        this.play(700, 0.1);
        setTimeout(() => this.play(950, 0.12), 120);
    },

    warning() {
        this.play(420, 0.15);
    },

    error() {
        this.play(220, 0.2);
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
};