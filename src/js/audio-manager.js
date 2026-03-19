/**
 * AUDIO MANAGER
 * Handles sound effects (SFX) and background music (BGM) using Howler.js.
 * Features: WebAudio support, persistent mute state, and cross-state music continuity.
 */
import { Howl, Howler } from 'howler';

export const AudioManager = {
    sounds: {},
    music: null,
    isMuted: localStorage.getItem('game_muted') === 'true',
    masterVolume: 0.7,

    /**
     * Loads a single audio file and returns a promise for preloader tracking.
     * @param {Object} file - Object containing name and path of the asset.
     */
    loadSingle: function(file) {
        return new Promise((resolve) => {
            this.sounds[file.name] = new Howl({
                src: [file.path],
                html5: false, // Force WebAudio for gapless playback and low latency
                preload: true,
                onload: () => {
                    resolve();
                },
                onloaderror: (id, err) => {
                    console.warn(`Audio Load Error (${file.name}):`, err);
                    resolve(); // Resolve anyway to avoid blocking the preloader
                }
            });
        });
    },

    /**
     * Batch preloads audio files (Used during Boot/Splash transitions).
     */
    preload: async function(audioFiles) {
        const promises = audioFiles.map(file => this.loadSingle(file));
        return Promise.all(promises);
    },

    /**
     * Plays a sound effect.
     * @returns {Howl|null} The Howl instance for further manipulation.
     */
    playSFX: function(name) {
        if (this.isMuted || !this.sounds[name]) return null;
        this.sounds[name].volume(this.masterVolume);
        this.sounds[name].play();
        return this.sounds[name]; 
    },

    /**
     * Sets a callback for when a specific sound ends.
     */
    onSoundEnd: function(name, callback) {
        if (this.sounds[name]) {
            this.sounds[name].once('end', callback);
        }
    },

    /**
     * Manages background music with continuity logic.
     */
    playMusic: function(name) {
        if (!this.sounds[name]) return;
        
        // Prevent restarting the same track if it's already playing (Audio Continuity)
        if (this.music && this.music === this.sounds[name] && this.music.playing()) return;

        // Stop current audio context to switch tracks
        Howler.stop();

        this.music = this.sounds[name];
        this.music.loop(true);
        this.music.volume(this.masterVolume * 0.5); // Music usually sits lower than SFX
        this.music.play();

        if(this.isMuted) {
            Howler.mute(this.isMuted);
        }
    },

    stopMusic: function() {
        if (this.music) {
            this.music.stop();
            this.music = null;
        }
    },

    /**
     * Smoothly fades out the current music track.
     */
    fadeOutMusic: function(duration = 500) {
        if (!this.music) return;
        const m = this.music;
        m.fade(m.volume(), 0, duration);
        m.once('fade', () => {
            m.stop();
            this.music = null;
        });
    },

    /**
     * Toggles global mute state and persists preference.
     */
    toggleMute: function() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('game_muted', this.isMuted);
        Howler.mute(this.isMuted);

        // Resume music playback if unmuted
        if (!this.isMuted && this.music && !this.music.playing()) {
            this.music.play();
        }
        
        console.log(`Global Audio Mute: ${this.isMuted ? 'ENABLED' : 'DISABLED'}`);
        return this.isMuted;
    },

    getMuteState: function() {
        return this.isMuted;
    }
};