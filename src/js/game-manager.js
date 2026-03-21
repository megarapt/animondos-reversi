import { initGame } from './game.js';
import { i18n } from './i18n.js';
import { AudioManager } from './audio-manager.js';

/**
 * Game states constants to ensure consistency across the application
 */
const GAME_STATES = {
    BOOT: 'BOOT',
    LOGO: 'LOGO',
    SPLASH: 'SPLASH',
    MAINMENU: 'MAINMENU',
    CHARACTER_PRELOADER: 'CHARACTER_PRELOADER',
    GAMEPLAY: 'GAMEPLAY'
};

/** 
 * Global data placeholders for AI and Opponents 
 */
let AiDifficulties = {};
let Opponents = [];

/**
 * INDEPENDENT SCROLL LOGIC
 * Handles custom scroll indicators for the character selection list
 */
function updateScrollIndicators() {
    const list = document.querySelector('.character-list');
    const upArrow = document.querySelector('.scroll-up');
    const downArrow = document.querySelector('.scroll-down');
    
    if (!list || !upArrow || !downArrow) return;

    // Check if the list is scrollable (+2px threshold for sub-pixel rendering)
    if (list.scrollHeight <= list.clientHeight + 2) {
        upArrow.classList.remove('visible');
        downArrow.classList.remove('visible');
        return;
    }

    // Toggle Up arrow based on scroll position
    if (list.scrollTop === 0) {
        upArrow.classList.remove('visible'); 
    } else {
        upArrow.classList.add('visible');    
    }

    // Toggle Down arrow based on reach
    if (list.scrollTop + list.clientHeight + 2 >= list.scrollHeight) {
        downArrow.classList.remove('visible'); 
    } else {
        downArrow.classList.add('visible');    
    }
}

/**
 * Handles FullScreen request specifically for mobile/touch devices
 */
function toggleFullScreen() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const element = document.documentElement;

    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

const gameScreens = document.querySelectorAll('.game-screen');

/**
 * ResizeObserver to handle dynamic scaling and aspect ratio detection
 */
const resizer = new ResizeObserver(entries => {
    entries.forEach(entry => {
        const screen = entry.target;
        const isVisible = window.getComputedStyle(screen).display !== 'none';

        if (isVisible) {
            const { width, height } = entry.contentRect;
            const ratio = width / height;
            
            // Inject CSS variables for dynamic styling in child components
            document.documentElement.style.setProperty('--current-ratio', ratio);
            document.documentElement.style.setProperty('--game-scale', width >= 500 ? 1 : width / 500);

            screen.classList.remove('ratio-x-large', 'ratio-large', 'ratio-small', 'ratio-wide');

            // Categorize aspect ratio for layout adjustments
            if (ratio <= 0.35) {
                screen.classList.add('ratio-x-large');
            } else if (ratio <= 0.43) {
                screen.classList.add('ratio-large'); 
            } else if (ratio >= 0.58 && ratio <= 0.8) {
                screen.classList.add('ratio-small'); 
            } else if (ratio > 0.8) {
                screen.classList.add('ratio-wide'); 
            }
        }
    });
});

gameScreens.forEach(screen => resizer.observe(screen));

function showDonationButton(isVisible) {
    const btn = document.getElementById('donation-corner');
    if (btn) {
        btn.style.display = isVisible ? 'block' : 'none';
    }
}

export const GameManager = {
    version: __APP_VERSION__, // Injected via Webpack
    currentState: null,
    selectedOpponent: null,
    
    // Temporary AI brain parameters
    aiCurrentDepth: null,
    aiCurrentHeuristic: null,
    aiCurrentErrorRate: null,
    aiCurrentStyle: null,

    init: function() {
        const characterListEl = document.querySelector('.character-list');
        if (characterListEl) {
            characterListEl.addEventListener('scroll', updateScrollIndicators);
        }

        window.addEventListener('resize', () => {
            if (this.currentState === GAME_STATES.MAINMENU) {
                updateScrollIndicators();
            }
        });

        // Service Worker registration for PWA capabilities
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log(`Service Worker registered. Version: ${this.version}`))
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }

        // Initialize engine at BOOT state
        this.changeState(GAME_STATES.BOOT);
    },

    changeState: function(newState) {
        this.currentState = newState;
        
        // 1. Hide all screens before transitioning
        document.querySelectorAll('.game-screen').forEach(screen => {
            screen.style.display = 'none';
        });

        // 1.5 Hide donation ribbon
        showDonationButton(false);

        // 2. State machine entry logic
        switch(newState) {
            case GAME_STATES.BOOT:
                document.getElementById('screen-boot').style.display = 'flex';
                this.runBootFlow();
                break;

            case GAME_STATES.LOGO:
                document.getElementById('screen-logo').style.display = 'flex';
                AudioManager.playSFX('raptware');
                this.runStaticPreloader();
                break;

            case GAME_STATES.SPLASH:
                const splashScreen = document.getElementById('screen-splash');
                splashScreen.style.backgroundImage = "url('img/splash.webp')";    
                splashScreen.style.display = 'flex';

                this.setVersion();

                // Play intro fanfare and chain the menu music loop
                AudioManager.playSFX('fanfare');
                AudioManager.onSoundEnd('fanfare', () => {
                    AudioManager.playMusic('menu');
                });
                
                splashScreen.onclick = () => {
                    AudioManager.playSFX('click');
                    this.changeState(GAME_STATES.MAINMENU);
                };
                break;

            case GAME_STATES.MAINMENU:
                const mainMenuScreen = document.getElementById('screen-mainmenu');
                mainMenuScreen.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('img/background.webp')";
                mainMenuScreen.style.display = 'flex';

                AudioManager.playMusic('menu');
                
                const listContainer = document.getElementById('opponent-list');
                if(!listContainer) break;

                listContainer.innerHTML = ''; // Clear previous instances
                
                // Render character selection cards
                Opponents.forEach(opp => {
                    let stats = JSON.parse(localStorage.getItem(`stats_${opp.id}`)) || { wins: 0, draws: 0, losses: 0 };
                    
                    const card = document.createElement('div');
                    card.className = 'character-card';
                    const diffData = AiDifficulties[opp.difficultyLevel];

                    const isDefeated = stats.wins > 0;
                    const badgeHTML = isDefeated ? `<div class="victory-badge" title="Defeated!">👑</div>` : '';

                    const difficultyText = i18n.t(diffData.name);
                    
                    card.innerHTML = `
                        ${badgeHTML}
                        <img src="${opp.portrait}" class="char-portrait" alt="${opp.name}">
                        <div class="char-info">
                            <div class="char-name">${opp.name}</div>
                            <div class="char-difficulty ${diffData.cssClass}">${difficultyText}</div>
                        </div>
                    `;
                    
                    card.onclick = () => {
                        AudioManager.playSFX('click');
                        this.currentOpponent = opp; 
                        this.changeState(GAME_STATES.CHARACTER_PRELOADER);
                    };

                    card.onmouseenter = () => {
                        const sfx = AudioManager.playSFX('over');
                        if (sfx) sfx.volume(0.2);
                    };
                    
                    listContainer.appendChild(card);
                });
                
                // Recalculate indicators after render
                setTimeout(updateScrollIndicators, 50);
                
                this.cleanupPreviousOpponent();

                // show donation ribbon on main menu
                showDonationButton(true);
                break;

            case GAME_STATES.CHARACTER_PRELOADER:
                AudioManager.fadeOutMusic();
                document.getElementById('screen-char-preloader').style.display = 'flex';
                this.runCharacterPreloader();
                break;

            case GAME_STATES.GAMEPLAY:
                AudioManager.playMusic('animondos_reversi');
                const gameplayScreen = document.getElementById('screen-gameplay');
                gameplayScreen.style.backgroundImage = "url('img/background.webp')"; 
                gameplayScreen.style.display = 'flex';

                // Initialize Board State Machine
                initGame(
                    this.aiCurrentDepth, 
                    this.aiCurrentHeuristic, 
                    this.aiCurrentErrorRate, 
                    this.aiCurrentStyle, 
                    this.currentOpponent.id, 
                    this.currentOpponent.name,
                    this.currentOpponent.patience || null,
                    (result) => {
                        if (result !== 'abandon') {
                            this.saveMatchResult(result);
                        }
                        this.changeState(GAME_STATES.MAINMENU);
                    }
                );
                break;
        }
    },

    /**
     * Handles initial core asset loading (i18n, logos, and critical SFX)
     */
    runBootFlow: async function() {
        const btn = document.getElementById('btn-boot');
        
        const loadI18n = i18n.init();

        // Preload core branding assets
        const logosToLoad = ['img/raptware.webp', 'img/animondos-logo.webp'];
        const loadLogos = logosToLoad.map(src => {
            return new Promise(resolve => {
                const img = new Image();
                img.src = src;
                img.onload = resolve;
                img.onerror = resolve; // Continue even if branding fails
            });
        });

        const audioPromise = AudioManager.preload([
            { name: 'raptware', path: 'audio/raptware.m4a', type: 'sfx' }
        ]);

        // Wait for all critical boot assets in parallel
        await Promise.all([loadI18n, audioPromise, ...loadLogos]);

        // UI transition to ready state
        btn.classList.remove('loading');
        btn.classList.add('ready');
        btn.innerHTML = '<span class="icon-play"></span>'; 

        btn.onclick = () => {
            this.changeState(GAME_STATES.LOGO);
            toggleFullScreen();
        };
    },

    /**
     * Preloads all generic game assets (BGM, common SFX, UI images)
     */
    runStaticPreloader: async function() {
        const logoScreen = document.getElementById('screen-logo');
        logoScreen.style.display = 'flex';

        const raptwareLogo = new Image();
        raptwareLogo.src = 'img/raptware.webp';
        raptwareLogo.className = 'logo';

        const animondosLogo = new Image();
        animondosLogo.src = 'img/animondos-logo.webp';
        animondosLogo.className = 'logo';

        logoScreen.appendChild(raptwareLogo);
        logoScreen.appendChild(animondosLogo);

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';

        const loadingText = document.createElement('span');
        loadingText.className = 'loading-text';
        loadingText.textContent = i18n.t('loading');

        loadingContainer.appendChild(progressBar);
        loadingContainer.appendChild(loadingText);
        logoScreen.appendChild(loadingContainer);

        setTimeout(() => {
            raptwareLogo.style.opacity = '1';
            animondosLogo.style.opacity = '1';
        }, 50);

        const minimumTimePromise = new Promise(resolve => {
            setTimeout(resolve, 3000);
        });

        // 1. Fetch Game Configuration Data
        try {
            const response = await fetch('data/game-data.json');
            if (!response.ok) throw new Error("HTTP error fetching JSON data");
            const data = await response.json();
            AiDifficulties = data.difficulties;
            Opponents = data.opponents;
        } catch (error) {
            console.error("Critical error loading game-data.json:", error);
        }

        const portraitsToLoad = Opponents.map(opp => opp.portrait).filter(Boolean);

        // 2. Define audio manifest
        const gameSounds = [
            { name: 'fanfare', path: 'audio/fanfare.m4a', type: 'sfx' },
            { name: 'menu', path: 'audio/menu.m4a', type: 'bgm' },
            { name: 'animondos_reversi', path: 'audio/animondos-reversi-theme.m4a', type: 'bgm' },
            { name: 'victory', path: 'audio/victory-jingle.m4a', type: 'bgm' },
            { name: 'defeat', path: 'audio/defeat-jingle.m4a', type: 'bgm' },
            { name: 'invalid', path: 'audio/sfx-invalid-move.m4a', type: 'sfx' },
            { name: 'place', path: 'audio/sfx-piece-place.m4a', type: 'sfx' },
            { name: 'turn', path: 'audio/sfx-piece-turn.m4a', type: 'sfx' },
            { name: 'click', path: 'audio/sfx-ui-click.m4a', type: 'sfx' },
            { name: 'over', path: 'audio/sfx-ui-over.m4a', type: 'sfx' }
        ];

        const allAssetsToLoad = [
            'img/background.webp',
            'img/board-bg.webp',
            'img/splash.webp',
            'img/reversi-logo.webp',
            ...portraitsToLoad 
        ];

        let loadedCount = 0; 
        const totalAssets = allAssetsToLoad.length + gameSounds.length;

        const onAssetLoaded = () => {
            loadedCount++;
            const percentage = (loadedCount / totalAssets) * 100;
            progressBar.style.width = `${percentage}%`; 
        };

        // 4. Preload Images
        const imagePromises = allAssetsToLoad.map(src => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => { onAssetLoaded(); resolve(); };
                img.onerror = () => { onAssetLoaded(); resolve(); }; 
            });
        });

        // 5. Preload Audio (Integrated with Howler Provider)
        const audioPromises = gameSounds.map(soundFile => {
            return AudioManager.loadSingle(soundFile).then(() => {
                onAssetLoaded(); 
            });
        });

        // 6. Finalize Preloader
        const allAssetsLoadedPromise = Promise.all([...imagePromises, ...audioPromises]).then(() => {
            loadingContainer.style.transition = 'opacity 0.5s ease-out';
            loadingContainer.style.opacity = '0';
        });

        await Promise.all([minimumTimePromise, allAssetsLoadedPromise]);

        console.log(`Logos displayed and ${totalAssets} total assets loaded.`);
        
        raptwareLogo.style.opacity = '0';
        animondosLogo.style.opacity = '0';
        
        setTimeout(() => {
            this.changeState(GAME_STATES.SPLASH);
            logoScreen.remove(); 
        }, 500); 
    },

    /**
     * Preloads specific character assets before starting a match
     */
    runCharacterPreloader: async function() {
            if (!this.currentOpponent) {
                console.error("Critical Failure: No opponent selected.");
                this.changeState(GAME_STATES.MAINMENU);
                return;
            }

            const opponent = this.currentOpponent;
            const preloaderScreen = document.getElementById('screen-char-preloader');
            
            preloaderScreen.innerHTML = ''; 

            const loadingContainer = document.createElement('div');
            loadingContainer.className = 'loading-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';

            const loadingText = document.createElement('span');
            loadingText.className = 'loading-text';
            loadingText.textContent = i18n.t('loading_char'); 

            loadingContainer.appendChild(progressBar);
            loadingContainer.appendChild(loadingText);
            preloaderScreen.appendChild(loadingContainer);

            let assetsToLoad = opponent.assets || []; 
            const totalAssets = assetsToLoad.length;
            let loadedCount = 0;

            if (totalAssets > 0) {
                const loadPromises = assetsToLoad.map(src => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.src = src;
                        
                        const onAssetLoaded = () => {
                            loadedCount++;
                            const percentage = (loadedCount / totalAssets) * 100;
                            progressBar.style.width = `${percentage}%`;
                            resolve();
                        };

                        img.onload = onAssetLoaded;
                        img.onerror = onAssetLoaded; 
                    });
                });

                await Promise.all(loadPromises);
            } else {
                progressBar.style.width = '100%';
            }

            const aiBrain = AiDifficulties[opponent.difficultyLevel];
            
            // Set session-specific AI parameters
            this.aiCurrentDepth = aiBrain.depth;
            this.aiCurrentHeuristic = aiBrain.heuristic;
            this.aiCurrentErrorRate = aiBrain.errorRate;
            this.aiCurrentStyle = opponent.playStyle || 'positional';

            setTimeout(() => {
                this.changeState(GAME_STATES.GAMEPLAY);
            }, 200);
    },

    /**
     * Memory cleanup for character assets
     */
    cleanupPreviousOpponent: function() {
        if (window.opponentData) {
            window.opponentData = null; 
            console.log("Memory cleared for previous opponent assets.");
        }
    },

    /**
     * Updates and persists local match statistics
     */
    saveMatchResult: function(result) {
        if (!this.currentOpponent) {
            console.error("Save Error: No active opponent found.");
            return; 
        }

        const storageKey = `stats_${this.currentOpponent.id}`;
        let stats = JSON.parse(localStorage.getItem(storageKey)) || { wins: 0, draws: 0, losses: 0 };

        if (result === 'win') stats.wins++;
        else if (result === 'draw') stats.draws++;
        else if (result === 'loss') stats.losses++;

        localStorage.setItem(storageKey, JSON.stringify(stats));
        console.log(`Stats updated for ${this.currentOpponent.name} -> W:${stats.wins} D:${stats.draws} L:${stats.losses}`);
    },

    /**
     * Renders version info with localized string interpolation
     */
    setVersion: function() {
        const infoDiv = document.getElementById('info-text');
        if (infoDiv) {
            infoDiv.textContent = i18n.t('info_text', { v: this.version });
        }
    }
};