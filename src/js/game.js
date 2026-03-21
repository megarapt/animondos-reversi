import { i18n } from './i18n.js';
import confetti from 'canvas-confetti';
import { AudioManager } from './audio-manager.js';

// --- GLOBAL CONSTANTS & STATE ---
const BOARD_SIZE = 8, EMPTY = 0, BLACK = 1, WHITE = 2;
let board = [], pieceElements = [], currentPlayer = BLACK, isAiTurn = false;
let isInputDisabled = false;

let currentAiDepth = 2;
let currentAiHeuristic = [];
let currentAiErrorRate = 0;
let currentAiPatience = null; // New variable for psychological patience factor in AI behavior
let currentOpponentId = 'giovanna';
let currentOpponentName = 'Giovanna';
let currentAiStyle = 'positional';
let onGameExit = null;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');

let aiWorker = null;
let currentMatchId = 0;

let isConfettiActive = false;

let activeTimeouts = new Set();

/**
 * Spawns a new Web Worker for AI calculations.
 * Terminates any existing worker to prevent memory leaks or ghost moves.
 */
function spawnWorker() {
    if (aiWorker) {
        aiWorker.onmessage = null;
        aiWorker.terminate();
    }
    
    // Create a fresh AI worker instance
    aiWorker = new Worker(new URL('./ai-worker.js', import.meta.url));
    
    aiWorker.onmessage = function(e) {
        // Ghost move protection: Ignore if it's no longer the AI's turn
        if (!isAiTurn) return; 
        
        const bestMove = e.data;
        if (bestMove) {
            const flips = getFlips(board, bestMove[0], bestMove[1], currentPlayer);
            executeMove(bestMove[0], bestMove[1], flips);
        } else {
            switchTurn();
        }
    };
}

/**
 * Initializes a new match with specific AI personality and difficulty.
 */
export function initGame(depth, heuristic, errorRate, style, opponentId, opponentName, opponentPatience, exitCallback) {
    currentAiDepth = depth;
    currentAiHeuristic = heuristic;
    currentAiErrorRate = errorRate;
    currentAiPatience = opponentPatience;
    currentAiStyle = style;
    currentOpponentId = opponentId;
    currentOpponentName = opponentName;
    onGameExit = exitCallback;

    // Reset UI buttons and messages
    document.querySelectorAll('.chip-btn').forEach(btn => btn.style.display = '');
    const exitMsg = document.getElementById('exit-message');
    if (exitMsg) exitMsg.style.display = 'none';

    currentMatchId++;
    spawnWorker();
    
    currentPlayer = BLACK; // Human (Black) always starts
    isAiTurn = false;
    isInputDisabled = false;    
    
    if (statusEl) {
        statusEl.textContent = i18n.t('status_player_turn');
        statusEl.classList.remove('thinking');
    }

    // Initialize logic board and piece references
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
    pieceElements = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(null));
    
    // Starting positions for Reversi
    board[3][3] = WHITE; board[3][4] = BLACK; board[4][3] = BLACK; board[4][4] = WHITE;

    setEmotion('idle'); 
    drawBoard();
    updateScore();
    showValidMoves();
}

/**
 * UI Asset Loader: Implements a progressive enhancement strategy for character portraits.
 * Attempts to load an optimized WebP version first (Production build).
 * Falls back to the original PNG if the optimized asset is missing (Dev mode / New content).
 * 
 * @param {HTMLImageElement} element - The target <img> DOM element.
 * @param {string} id - The unique identifier for the opponent (e.g., 'giovanna').
 * @param {string} emotion - The state string (e.g., 'idle', 'won', 'thinking').
 */
const setImageWithFallback = (element, id, emotion) => {
    const webpPath = `img/${id}-${emotion}.webp`;
    const pngPath = `img/${id}-${emotion}.png`;

    // Attempt to load the optimized high-performance format
    element.src = webpPath;

    // Error handling logic for missing assets
    element.onerror = () => {
        // Check if the failure happened on the WebP attempt to prevent infinite loops
        if (element.src.endsWith('.webp')) {
            // Fallback to the original source asset provided by the artist
            element.src = pngPath;
            
            // Clear the handler to prevent further error bubbling if PNG also fails
            element.onerror = null;
        }
    };
};

/**
 * Updates the opponent's portrait based on the current game state.
 */
function setEmotion(emotionStr) {
    const portraitEl = document.querySelector('#opponent-character img');
    if (portraitEl) {
        setImageWithFallback(portraitEl, currentOpponentId, emotionStr);
    }
}

function drawBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.onclick = () => handlePlayerClick(r, c);
            
            const piece = document.createElement('div');
            piece.className = 'piece';
            cell.appendChild(piece);
            pieceElements[r][c] = piece;
            updateVisuals(r, c);
            boardEl.appendChild(cell);
        }
    }
}

function updateVisuals(r, c) {
    const piece = pieceElements[r][c];
    piece.className = 'piece ' + (board[r][c] === BLACK ? 'black' : board[r][c] === WHITE ? 'white' : '');
}

/**
 * Logic Board representation of the 8x8 Reversi grid
 */


function handlePlayerClick(row, col) {
    if (isInputDisabled || isAiTurn) return; // State Machine: Ignore clicks while AI is processing
    
    const flips = getFlips(board, row, col, currentPlayer);
    if (flips.length > 0) {
        AudioManager.playSFX('place');
        clearValidMoves();
        executeMove(row, col, flips);
    } else {
        AudioManager.playSFX('invalid');
    }
}

function executeMove(row, col, flips) {
    isInputDisabled = true; // Block inputs during move animation
    board[row][col] = currentPlayer;
    updateVisuals(row, col);

    // --- REACTION LOGIC: Update character emotions based on move quality ---
    if (currentPlayer === BLACK) { 
        const isCorner = (row === 0 || row === 7) && (col === 0 || col === 7);
        
        if (isCorner) {
            setEmotion('lost-corner'); 
        } else if (flips.length >= 5) {
            setEmotion('good-player-move'); // Critical move
        } else {
            setEmotion('bad-player-move'); 
        }
    } else {
        setEmotion('throw'); 
    }

    // Flip animation sequence
    flips.forEach(([r, c], index) => {
        board[r][c] = currentPlayer;
        setTrackedTimeout(() => {
            const piece = pieceElements[r][c];
            piece.classList.add('flipped');
            setTrackedTimeout(() => {
                const turnSound = AudioManager.playSFX('turn');
                if (turnSound) turnSound.rate(1.0 + (index * 0.05)); // Pitched turn sounds

                updateVisuals(r, c);
                piece.classList.remove('flipped');
            }, 150);
        }, index * 100);
    });

    updateScore();

    // Ensure turn doesn't switch until animations complete
    const rawAnimationTime = (flips.length * 100) + 150;
    const animationTime = Math.max(rawAnimationTime, 500); 
    setTrackedTimeout(() => switchTurn(), animationTime);
}

async function switchTurn() {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    
    // 1. Check if the current player has available moves
    if (hasValidMoves(currentPlayer)) {
        if (currentPlayer === WHITE) {
            // --- STATE: AI THINKING ---
            statusEl.textContent = i18n.t('status_thinking', { name: currentOpponentName });
            statusEl.classList.add('thinking');
            setEmotion('thinking'); 

            const expectedMatchId = currentMatchId;

            console.log(`--- AI TURN (${currentOpponentId}) ---`);
            console.log(`Search Depth: ${currentAiDepth}`);
            console.table(currentAiHeuristic);

            // Promise setup for "Game Feel": Minimum 500ms delay to simulate thought
            const minimumTimePromise = new Promise(resolve => setTrackedTimeout(resolve, 500));
            
            const aiCalculationPromise = new Promise(resolve => {
                aiWorker.onmessage = (e) => resolve(e.data);
                aiWorker.postMessage({ 
                    board, 
                    player: WHITE, 
                    depth: currentAiDepth, 
                    heuristic: currentAiHeuristic, 
                    errorRate: currentAiErrorRate,
                    patience: currentAiPatience,
                    style: currentAiStyle
                }); 
            });

            // Wait for both computation and game-feel timer
            const [_, bestMove] = await Promise.all([minimumTimePromise, aiCalculationPromise]);

            if (expectedMatchId !== currentMatchId) {
                console.warn("Ghost move successfully blocked.");
                return;
            }

            if (bestMove) {
                const flips = getFlips(board, bestMove[0], bestMove[1], WHITE);
                executeMove(bestMove[0], bestMove[1], flips);
            }
            
        } else {
            // --- STATE: PLAYER TURN ---
            statusEl.textContent = i18n.t('status_player_turn');
            statusEl.classList.remove('thinking');
            setEmotion('idle'); 
            isAiTurn = false; 
            isInputDisabled = false;
            showValidMoves();
        }
        return;
    }

    // 2. Handle turn skipping if no moves are available
    const opponent = currentPlayer === BLACK ? WHITE : BLACK;
    if (hasValidMoves(opponent)) {
        statusEl.textContent = i18n.t('status_skip'); 
        statusEl.classList.remove('thinking');
        statusEl.classList.add('alert-skip'); 
        
        setEmotion(currentPlayer === BLACK ? 'bad-player-move' : 'good-player-move');
        
        setTrackedTimeout(() => {
            statusEl.classList.remove('alert-skip'); 
            switchTurn();
        }, 2000);
        return;
    }

    // 3. Board full or both players blocked
    endGame();
}

function hasValidMoves(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (getFlips(board, r, c, player).length > 0) return true;
        }
    }
    return false;
}

function endGame() {
    let blackCount = 0, whiteCount = 0;
    board.forEach(r => r.forEach(cell => { 
        if(cell === BLACK) blackCount++; 
        if(cell === WHITE) whiteCount++; 
    }));
    
    let winnerText = "";
    let matchResult = ''; 

    if (blackCount > whiteCount) {
        AudioManager.playMusic('victory');
        winnerText = i18n.t('win_msg');
        setEmotion('lost'); 
        matchResult = 'win';
        fireConfettiCannons(); 
    } else if (whiteCount > blackCount) {
        AudioManager.playMusic('defeat');
        winnerText = i18n.t('loss_msg', { name: currentOpponentName });
        setEmotion('won'); 
        matchResult = 'loss';
    } else {
        AudioManager.playMusic('defeat');
        winnerText = i18n.t('draw_msg');
        setEmotion('idle'); 
        matchResult = 'draw';
    }
    
    statusEl.textContent = winnerText;
    statusEl.classList.remove('thinking');

    waitForClickToExit(matchResult);
}

/**
 * Captures a global click event to return to the main menu after match completion.
 */
function waitForClickToExit(finalResult) {
    console.log("Match ended. Waiting for user interaction to exit...");

    document.querySelectorAll('.chip-btn').forEach(btn => btn.style.display = 'none');
    const exitMsg = document.getElementById('exit-message');
    if (exitMsg) exitMsg.style.display = 'flex';

    // Click catcher overlay
    const clickCatcher = document.createElement('div');
    Object.assign(clickCatcher.style, {
        position: 'absolute',
        top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '9999', cursor: 'pointer'
    });
    
    clickCatcher.onclick = () => {
        clickCatcher.remove(); 
        if (typeof onGameExit === 'function') {
            stopAllEffects();
            onGameExit(finalResult); 
        }
    };
    
    const gameplayScreen = document.getElementById('screen-gameplay');
    if (gameplayScreen) gameplayScreen.appendChild(clickCatcher);
}

function getFlips(board, row, col, player) {
    if (board[row][col] !== EMPTY) return [];
    const opponent = player === BLACK ? WHITE : BLACK;
    let piecesToFlip = [];
    const directions = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc, path = [];
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
            path.push([r, c]); r += dr; c += dc;
        }
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player && path.length > 0) {
            piecesToFlip = piecesToFlip.concat(path);
        }
    }
    return piecesToFlip;
}

function updateScore() {
    let blackCount = 0, whiteCount = 0;
    board.forEach(r => r.forEach(cell => { 
        if(cell === BLACK) blackCount++; 
        if(cell === WHITE) whiteCount++; 
    }));
    
    const scoreBlackEl = document.getElementById('score-black');
    const scoreWhiteEl = document.getElementById('score-white');
    
    if (scoreBlackEl) scoreBlackEl.textContent = blackCount;
    if (scoreWhiteEl) scoreWhiteEl.textContent = whiteCount;
}

// --- UI BUTTONS & EVENT LISTENERS ---
const btnExit = document.getElementById('btn-exit');
const btnRestart = document.getElementById('btn-restart');
const btnAudio = document.getElementById('btn-audio');

const playHover = () => {
    const sfx = AudioManager.playSFX('over');
    if (sfx) sfx.volume(0.2);
};

[btnExit, btnRestart, btnAudio].forEach(btn => {
    if (btn) btn.onmouseenter = playHover;
});

btnExit.onclick = () => {
    AudioManager.playSFX('click');
    if (typeof onGameExit === 'function') {
        onGameExit('abandon'); 
    }
};

btnRestart.onclick = () => {
    isAiTurn = false;
    AudioManager.playSFX('click');
    clearAllTasks();
    initGame(currentAiDepth, currentAiHeuristic, currentAiErrorRate, currentAiStyle, currentOpponentId, currentOpponentName, currentAiPatience, onGameExit);
};

let isAudioOn = !AudioManager.getMuteState(); 

if (btnAudio) {
    btnAudio.classList.toggle('off', !isAudioOn);
    btnAudio.textContent = isAudioOn ? i18n.t('btn_audio_on') : i18n.t('btn_audio_off');
}

btnAudio.onclick = (e) => {
    const muted = AudioManager.toggleMute();
    isAudioOn = !muted;
    AudioManager.playSFX('click');
    
    e.currentTarget.classList.toggle('off', !isAudioOn);
    e.currentTarget.textContent = isAudioOn ? i18n.t('btn_audio_on') : i18n.t('btn_audio_off');
};

/**
 * Visual aids: Highlight legal moves for the player
 */
function showValidMoves() {
    clearValidMoves();
    if (currentPlayer !== BLACK || isAiTurn) return; 

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (getFlips(board, r, c, BLACK).length > 0) {
                const indicator = document.createElement('div');
                indicator.className = 'valid-move-indicator';
                const cellEl = pieceElements[r][c].parentElement;
                cellEl.appendChild(indicator);
            }
        }
    }
}

function clearValidMoves() {
    document.querySelectorAll('.valid-move-indicator').forEach(el => el.remove());
}

/**
 * Celebration Confetti Cannon
 */
function fireConfettiCannons() {
    isConfettiActive = true;
    const canvasEl = document.getElementById('confetti-canvas');
    const myConfetti = confetti.create(canvasEl, { resize: true });
    const festiveColors = ['#ff0b0b', '#ffdf00', '#0b5ed7', '#198754'];
    const duration = 3300;
    const end = Date.now() + duration;

    (function frame() {
        if (!isConfettiActive) {
            myConfetti.reset();
            return;
        }
        myConfetti({
            particleCount: 5, angle: 60, spread: 55, startVelocity: 60,
            scalar: 1.3, ticks: 220, origin: { x: 0, y: 0.75 }, colors: festiveColors
        });
        myConfetti({
            particleCount: 5, angle: 120, spread: 55, startVelocity: 60,
            scalar: 1.3, ticks: 220, origin: { x: 1, y: 0.75 }, colors: festiveColors
        });

        if (Date.now() < end) requestAnimationFrame(frame);
        else isConfettiActive = false;
    }());
}

function stopAllEffects() {
    isConfettiActive = false;
    const canvasEl = document.getElementById('confetti-canvas');
    if (canvasEl) {
        // Limpiamos el canvas físicamente
        const context = canvasEl.getContext('2d');
        if (context) context.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
}

/**
 * Registers and executes a tracked timeout.
 * Ensures all pending UI tasks can be cleared on game reset.
 */
function setTrackedTimeout(callback, delay) {
    const id = setTimeout(() => {
        activeTimeouts.delete(id);
        callback();
    }, delay);
    activeTimeouts.add(id);
    return id;
}

/**
 * Aborts all scheduled UI animations and logic tasks.
 */
function clearAllTasks() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts.clear();
}