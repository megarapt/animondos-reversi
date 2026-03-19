/**
 * APPLICATION ENTRY POINT
 * Initializes the global Game Manager once the DOM is fully loaded.
 */

// Import styles for Webpack processing (Minification, Autoprefixing, etc.)
import '../css/style.css'; 

// Import the Core Game Engine
import { GameManager } from './game-manager.js';

// Bootstrap the application as soon as the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing Game Manager...");
    
    // Start the global state machine
    GameManager.init();
});