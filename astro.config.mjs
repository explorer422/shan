import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// ponytail: Ensure .env is loaded in dev before Vite server config
if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
  try {
    process.loadEnvFile();
  } catch {}
}

// ponytail: Dev-only middleware serving local media without polluting dist/
function localMediaDevPlugin() {
  return {
    name: 'local-media-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/media/')) {
          const cleanUrl = req.url.split('?')[0];
          const relPath = cleanUrl.replace(/^\/media\//, '');
          const localPath = path.join(
            process.cwd(),
            '.local-media',
            relPath
          );
          if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            const ext = path.extname(localPath).toLowerCase();
            const mimeMap = {
              '.webp': 'image/webp',
              '.avif': 'image/avif',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
            };
            const mime = mimeMap[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            return fs.createReadStream(localPath).pipe(res);
          } else if (process.env.PUBLIC_MEDIA_BASE_URL) {
            const remoteBase = process.env.PUBLIC_MEDIA_BASE_URL.replace(
              /\/$/,
              ''
            );
            res.writeHead(302, {
              Location: `${remoteBase}/${relPath}`,
            });
            return res.end();
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  output: 'static',
  site: process.env.ASTRO_SITE || 'https://shan.page',
  base: process.env.ASTRO_BASE || '/',
  trailingSlash: 'always',
  vite: {
    plugins: [
      tailwindcss(),
      localMediaDevPlugin(),
    ],
  },
});
