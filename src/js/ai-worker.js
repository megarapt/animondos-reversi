/**
 * REVERSI AI WORKER
 * Implements Minimax algorithm with Alpha-Beta pruning for high-performance move calculation.
 */

// --- GLOBAL CONSTANTS ---
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// Worker state variables
let currentHeuristic = [];
let currentStyle = "positional";

/**
 * CORE ENGINE: MINIMAX ALGORITHM WITH ALPHA-BETA PRUNING
 */
function minimax(board, depth, alpha, beta, isMaximizing, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    const currentPlayer = isMaximizing ? player : opponent;
    const validMoves = getAllValidMoves(board, currentPlayer);

    // Termination condition: depth limit reached or no moves available (end of game)
    if (depth === 0 || validMoves.length === 0) {
        return { 
            score: evaluateBoard(board, player), 
            move: null 
        };
    }

    let bestMove = validMoves[0].move;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let { move, flips } of validMoves) {
            let simulatedBoard = simulateMove(board, move, flips, currentPlayer);
            let evalScore = minimax(simulatedBoard, depth - 1, alpha, beta, false, player).score;
            
            if (evalScore > maxEval) {
                maxEval = evalScore;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break; // Alpha-Beta Pruning
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        for (let { move, flips } of validMoves) {
            let simulatedBoard = simulateMove(board, move, flips, currentPlayer);
            let evalScore = minimax(simulatedBoard, depth - 1, alpha, beta, true, player).score;
            
            if (evalScore < minEval) {
                minEval = evalScore;
                bestMove = move;
            }
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break; // Alpha-Beta Pruning
        }
        return { score: minEval, move: bestMove };
    }
}

/**
 * BOARD EVALUATOR (Multiple AI Personalities)
 */
function evaluateBoard(board, player, overrideStyle = null) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let score = 0;
    const style = overrideStyle || currentStyle;

    // 1. Greedy: Prioritizes maximum piece count
    if (style === "greedy") {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === player) score += 1;
                else if (board[row][col] === opponent) score -= 1;
            }
        }
        return score;
    }

    // 2. Evasive: Minimizes piece count early but prioritizes corners
    if (style === "evasive") {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === player) score -= 1;
                else if (board[row][col] === opponent) score += 1;
            }
        }
        // Massive bonus for corners
        if (board[0][0] === player) score += 50;
        if (board[0][7] === player) score += 50;
        if (board[7][0] === player) score += 50;
        if (board[7][7] === player) score += 50;
        return score;
    }

    // 3. Frontier: Penalizes pieces that are exposed to empty adjacent squares
    if (style === "frontier") {
        let myFrontier = 0;
        let oppFrontier = 0;
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === player && isFrontier(board, row, col)) myFrontier++;
                if (board[row][col] === opponent && isFrontier(board, row, col)) oppFrontier++;
            }
        }
        score = oppFrontier - myFrontier; 
        score += 0.1 * evaluateBoard(board, player, "positional"); 
        return score;
    }

    // 4. Mobility: Aims to have more move options than the opponent
    if (style === "mobility") {
        score = 10 * (getAllValidMoves(board, player).length - getAllValidMoves(board, opponent).length);
        score += 0.2 * evaluateBoard(board, player, "positional");
        return score;
    }

    // 5. Dynamic: Switches style based on the game phase (Early, Mid, Late)
    if (style === "dynamic") {
        let emptyCount = getEmptyCount(board);
        if (emptyCount > 40) return evaluateBoard(board, player, "evasive");  // Early game
        if (emptyCount > 14) return evaluateBoard(board, player, "mobility"); // Mid game
        return evaluateBoard(board, player, "greedy");                        // Late game (sweep)
    }

    // Default (Positional): Uses the weight matrix (currentHeuristic)
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === player) {
                score += currentHeuristic[row][col];
            } else if (board[row][col] === opponent) {
                score -= currentHeuristic[row][col];
            }
        }
    }
    return score;
}

// --- UTILITY FUNCTIONS ---

function getEmptyCount(board) {
    let count = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === EMPTY) count++;
        }
    }
    return count;
}

function isFrontier(board, row, col) {
    const directions = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
    for (let [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === EMPTY) {
            return true;
        }
    }
    return false;
}

function getAllValidMoves(board, player) {
    let moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            let flips = getFlips(board, row, col, player);
            if (flips.length > 0) {
                moves.push({ move: [row, col], flips: flips });
            }
        }
    }
    return moves;
}

function getFlips(board, row, col, player) {
    if (board[row][col] !== EMPTY) return [];
    
    const opponent = player === BLACK ? WHITE : BLACK;
    let flipsToMake = [];
    const directions = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        let potentialFlips = [];
        
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
            potentialFlips.push([r, c]);
            r += dr;
            c += dc;
        }
        
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player && potentialFlips.length > 0) {
            flipsToMake = flipsToMake.concat(potentialFlips);
        }
    }
    return flipsToMake;
}

function simulateMove(board, move, flips, player) {
    // Deep clone board matrix
    let newBoard = board.map(row => [...row]);
    
    // Apply placement and flips
    newBoard[move[0]][move[1]] = player;
    flips.forEach(([r, c]) => {
        newBoard[r][c] = player;
    });
    
    return newBoard;
}

// --- MAIN THREAD COMMUNICATION ---
self.onmessage = function(e) {
    const { board, player, depth, heuristic, errorRate, style } = e.data;
    
    // Debugging logs
    if (!heuristic || heuristic.length === 0) {
        console.error("CRITICAL ERROR: Worker received an empty or undefined heuristic matrix.");
    }
    
    // Assign global configuration
    currentHeuristic = heuristic;
    currentStyle = style || "positional";

    const validMoves = getAllValidMoves(board, player);

    // Human Error Rate Simulation
    if (Math.random() < errorRate) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        self.postMessage(randomMove.move);
        return;
    }

    // Standard Minimax calculation
    const bestMoveData = minimax(board, depth, -Infinity, Infinity, true, player);
    self.postMessage(bestMoveData.move);
};