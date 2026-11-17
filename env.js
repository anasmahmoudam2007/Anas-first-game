// Static boot config for static hosting — GitHub Pages, Netlify, Vercel, any
// plain file server (see DEPLOY-VERCEL.md). The Node server generates this
// file dynamically (src/server/http.js, PUBLIC_URL env var) and takes
// precedence when it serves the client itself — this copy only answers on
// static hosting, where the server's route does not exist.
//
// Set wsUrl to your game server so a static deployment joins it by default,
// e.g. a Colyseus host on Railway/Render/Fly or a Cloudflare tunnel:
//   window.__OPENGAME__ = { wsUrl: 'wss://game.yourdomain.com' };
// null = fall back to the ?server= share link / same-origin / localhost
// chain in src/config.js (and, when nothing is reachable — the normal case on
// Vercel, which cannot run the Node/WebSocket server — the browser-local
// single-player mode in src/LocalRoom.js).
window.__OPENGAME__ = { wsUrl: null, bloom: false };
