# Radio server

The app listens on TCP port `3000` by default. `PORT` accepts an integer from `1` through `65535`.

`GET /` serves the status page. `GET /health` checks that the process responds. `GET /ready` reports that the app can accept requests. Both status routes return HTTP 200 with JSON.

The browser page and compiled bundle come from `public/` and `dist/`. Run `npm run build` before starting the app locally. The container image builds the browser bundle.

Run `npm start` for local development. Use `docker compose up -d --build` to start the container. Use `docker compose down` to stop it. Check `/health` and `/ready` after startup.

This scaffold does not capture SDR data or provide live audio.
