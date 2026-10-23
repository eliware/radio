# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/radio [![License](https://img.shields.io/github/license/eliware/radio)](https://github.com/eliware/radio/blob/main/LICENSE) [![CI](https://github.com/eliware/radio/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/radio/actions/workflows/ci.yaml)

Web-based SDR streaming

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Configuration](#configuration)
- [Operations](#operations)
- [Routes](#routes)
- [Assets](#assets)
- [Development server](#development-server)
- [Build](#build)
- [Deployment](#deployment)
- [Support](#support)
- [Links](#links)
- [License](#license)

## Features

Radio provides a private player for two NFM channels. RTLSDR-Airband applies configured
CTCSS squelch and sends channel audio to Icecast.

The web player can be installed as a portrait, standalone PWA. It does not cache audio or
provide offline playback.

## Requirements

Use Node.js 26 or later and npm. Docker Compose is available for container deployment.

## Setup

Run `npm ci` to install web dependencies. Docker Compose loads the local `.env`, which contains
channel settings, dongle serials, and the private Icecast source password. Do not commit it.

## Usage

Run `npm start` to launch only the web player. Use Docker Compose to run the full player,
receiver, and Icecast stack. Read the [release notes](RELEASE_NOTES.md) for changes.

## Development

Read [AGENTS.md](AGENTS.md), the [specifications](specs/README.md), and the [documentation index](docs/README.md) before changing source files.

## Testing

Run `npm test` to validate the repository. Run `npm run build` to create the browser bundle.

## Troubleshooting

Check `/health` and `/ready` for web status. The SDR and Icecast supervisors expose the same
routes internally on ports `9101` and `9102`. Read logs with
`docker compose logs -f radio sdr icecast`.

## Security

The status page has no authentication. Keep the app on a trusted network.

## Configuration

Set the spare SDR dongle serials and a random `ICECAST_SOURCE_PASSWORD` in `.env`. Police and
Fire frequency and PL values are also read from `.env`. Set `PORT` to change the player port.
The default is `3000`.

## Operations

Use `docker compose up -d --build` to build and start all three containers. Use
`docker compose down` to stop them.

## Routes

- `GET /` serves the status page.
- `GET /health` reports process health.
- `GET /ready` reports application readiness.
- `GET /channels` reports Police and Fire receiver states separately.
- `GET /streams/police.mp3` proxies the Police audio stream.
- `GET /streams/fire.mp3` proxies the Fire audio stream.

Both status routes return HTTP 200 and a JSON status value.

## Assets

The app serves files from `public/` and `dist/`. Webpack writes the browser bundle to
`dist/client.js`. The player page has separate Police and Fire audio controls. The web manifest,
app icons, and install screenshots are in `public/`. Run `npm run screenshots` while the app is
available to refresh the desktop screenshot and PWA assets.

## Development server

Run `npm run build`, then run `npm start`. Open `http://localhost:3000` in a browser.

## Build

Run `npm run build` to bundle readiness, receiver state, and audio status updates.

## Deployment

Run `docker compose up -d --build`. On this server, open `http://localhost:3001`.
Radar uses port `3000`. Confirm the player health routes return status 200. The SDR remains
unready until both spare dongle serial numbers are configured.

The NAS nginx virtual host at `radio.purinton.us` proxies HTTPS traffic to `127.0.0.1:3001`
using the existing `purinton.us` wildcard certificate. Its source configuration is
`nginx/radio.purinton.us.conf`.

## Support

For help, questions, or to chat with the author and community, visit:

[![Discord](https://eliware.org/logos/discord_96.png)](https://discord.gg/M6aTR9eTwN)[![eliware.org](https://eliware.org/logos/eliware_96.png)](https://discord.gg/M6aTR9eTwN)

**[eliware.org on Discord](https://discord.gg/M6aTR9eTwN)**

## Links

- [Home Page](https://eliware.org)
- [GitHub Org](https://github.com/eliware)
- [GitHub Repo](https://github.com/eliware/radio)
- [Bug Reports](https://github.com/eliware/radio/issues)
- [Discord](https://discord.gg/M6aTR9eTwN)

## License

[MIT © Eliware](LICENSE)
