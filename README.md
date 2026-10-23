# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/radio [![License](https://img.shields.io/github/license/eliware/radio)](https://github.com/eliware/radio/blob/main/LICENSE) [![CI](https://github.com/eliware/radio/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/radio/actions/workflows/ci.yaml)

NBFM receiver audio bridge to Zello channels

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
- [Support](#support)
- [Links](#links)
- [License](#license)

## Features

Radio receives two local NBFM channels and forwards CTCSS-gated audio to their Zello channels.
Node.js supervises one RTLSDR-Airband process and keeps one Zello WebSocket connected for each
channel. The sockets stay connected while the receivers are idle.

The receiver sends a one-second configured tone to both channels at container startup. Runtime
audio uses the CTCSS squelch and notch settings from each channel file.

## Requirements

Use Node.js 26 or later and npm for local development. Container deployment uses Docker Compose.
Two RTL-SDR dongles and production Zello issuer credentials are required.

## Setup

Run `npm ci` to install dependencies. Copy `.env.example` to `.env.pd` and `.env.fd`, then fill in
the matching channel account and SDR values. Set each private file to mode `600`.

## Usage

Run `docker compose up -d --build` to start the bridge. Read the [release notes](RELEASE_NOTES.md)
for changes. Check the [documentation index](docs/README.md) and [specifications](specs/README.md)
for operating details and repository requirements.

## Development

Read [AGENTS.md](AGENTS.md) before changing source files. Implementation lives in `src/`, the
container entry point is `bin/zello-radio.mjs`, and tests live in `tests/`.

## Testing

Run `npm test` for repository validation. Run `npm run format` to apply formatting and
`npm run format:check` to check it.

## Troubleshooting

Read container output with `docker compose logs -f radio`. `/health` responds while the Node.js
supervisor runs. `/ready` succeeds only when RTLSDR-Airband runs and both Zello sessions are
connected and logged in.

## Security

Keep `.env.pd` and `.env.fd` private. They contain account passwords and signing keys. The files
are excluded from Git and the Docker build context.

## Configuration

Each channel file contains `CHANNEL`, `USERNAME`, `PASSWORD`, `ISSUER`, `PRIVATE_KEY`, `SDR_SERIAL`,
`FREQUENCY_MHZ`, `CTCSS_HZ`, and `TONE`. Radio signs a production JWT with `ISSUER` and
`PRIVATE_KEY`. Do not use a Sample Development Token.

## Operations

Compose runs one container with Node.js as PID 1 and one RTLSDR-Airband process. The container
checks for both dongle serials, connects to Zello, then starts the receiver. Each Zello socket stays
open across radio transmissions and uses exponential reconnect delays capped at five minutes.

The status endpoints use port `1400`, bound to localhost. Compose mounts both channel files as
read-only and passes USB devices through `/dev/bus/usb`. Run `docker compose down` to stop the bridge.

Logs are timestamped JSON records with `debug`, `info`, `warn`, and `error` levels. Set `LOG_LEVEL`
to set the minimum output level. The default is `info`. The logger redacts credential fields and
known values from channel configuration files.

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
