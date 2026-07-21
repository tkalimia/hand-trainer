import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Hand Surgery Trainer — installable, offline-first PWA.
// The app shell is precached; question JSON is stale-while-revalidate and
// images are cache-first, so the app runs fully offline after first load.
//
// `BASE_PATH` lets the same code host at a sub-path (GitHub Pages, e.g.
// "/hand-trainer/") or at the domain root (NAS, "/"). Defaults to root.
const base = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "splash/*.png"],
      manifest: {
        name: "Hand Surgery Trainer",
        short_name: "HandTrainer",
        description: "Learn hand surgery in the dead space of your day.",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Question bank JSON (Dropbox / NAS): keep fresh but work offline.
            urlPattern: ({ url }) =>
              /questions.*\.json(\?|$)/.test(url.href) ||
              /dropboxapi\.com|dropboxusercontent\.com/.test(url.hostname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "question-data",
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Question images.
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "question-images",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Heebo web font.
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.hostname),
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true },
});
