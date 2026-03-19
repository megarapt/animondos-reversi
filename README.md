# Animondos' Reversi - 15th Anniversary Edition 🎊

A high-performance, web-based Reversi (Othello) engine developed to celebrate the **15th Anniversary of the Animondos comic** and **23 years of Raptware Studio**. This project is a technical showcase of modern web optimization, multithreaded AI logic, and a responsive 2.5D CSS rendering system.

## 🚀 Technical Highlights

*   **Multithreaded AI Core:** Implements an asynchronous Minimax algorithm with Alpha-Beta pruning running on a dedicated **Web Worker**. This ensures 60FPS UI stability by offloading heavy calculations from the main thread.
*   **Surgical Scaling System:** Features a custom CSS-variable-driven scaling engine that maintains visual integrity across mobile notches, tablets, and Ultra-Wide monitors using dynamic aspect ratio calculations.
*   **Hybrid 2.5D Rendering:** Combines static high-definition board assets with a 3D-transformed CSS grid (rotateX/translateZ) for an immersive perspective without the overhead of a full WebGL engine.
*   **Optimized Asset Pipeline:** Integrated Webpack & Sharp workflow that automatically processes high-resolution PNGs into performance-ready WebP assets during the production build.

## 🛠️ Built With

*   **Logic:** JavaScript (ES6+) & Web Workers API
*   **Styling:** Reactive CSS3 Variables & 3D Transforms
*   **Build Tooling:** Webpack 5, Sharp, ImageMinimizerPlugin
*   **Audio:** Howler.js for spatial and pitched SFX management
*   **Visuals:** Canvas-confetti for high-performance particle systems

## ⚖️ License & Intellectual Property

This project is released under the **MIT License**.

> **IMPORTANT:** This license applies **ONLY** to the source code of the project. 
> 
> All character designs, names, branding, logos, and narrative elements associated with "Animondos" and "Raptware" are the exclusive intellectual property of **Roberto Pavón / Raptware**. These assets are **NOT** included in this repository and are not covered by the open-source license.

## 🔧 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USER/animondos-reversi.git](https://github.com/YOUR_USER/animondos-reversi.git)
   
2. **Install dependencies:**
   ```bash
   npm install

3. **Development Mode:**
   ```bash
   npm run start

4. **Production Build:**
   ```bash
   npm run build

*Note: To run the game locally, you must provide your own image assets in the `etc/hd-img/` directory following the naming convention defined in the source code.*

---
Developed by **Raptware** - *Celebrating 23 Years of Indie Game Development.*
