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

Radio provides a small status page and health routes for the future radio application. SDR capture and live audio are not part of this scaffold.

## Requirements

Use Node.js 26 or later and npm. Docker Compose is available for container deployment.

## Setup

Run `npm ci` to install dependencies. Copy `.env.example` to `.env` to set the listening port.

## Usage

Run `npm start` to launch the web server. Read the [release notes](RELEASE_NOTES.md) for changes.

## Development

Read [AGENTS.md](AGENTS.md), the [specifications](specs/README.md), and the [documentation index](docs/README.md) before changing source files.

## Testing

Run `npm test` to validate the repository. Run `npm run build` to create the browser bundle.

## Troubleshooting

Check `/health` for process status and `/ready` for readiness. Read container logs with `docker compose logs radio`.

## Security

The status page has no authentication. Keep the app on a trusted network.

## Configuration

Set `PORT` in `.env` or the process environment. The default is `3000`. Valid values are integers from `1` through `65535`.

## Operations

Use `docker compose up -d --build` to build and start the container. Use `docker compose down` to stop it.

## Routes

- `GET /` serves the status page.
- `GET /health` reports process health.
- `GET /ready` reports application readiness.

Both status routes return HTTP 200 and a JSON status value.

## Assets

The app serves files from `public/` and `dist/`. Webpack writes the browser bundle to `dist/client.js`.

## Development server

Run `npm run build`, then run `npm start`. Open `http://localhost:3000` in a browser.

## Build

Run `npm run build` to bundle the readiness status text.

## Deployment

Run `docker compose up -d --build`. Confirm `http://localhost:3000/health` and `http://localhost:3000/ready` return status 200.

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
