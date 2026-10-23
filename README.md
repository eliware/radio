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

Radio forwards two local NBFM receiver channels to their matching Zello channels.

## Requirements

Runtime needs a Linux Docker Compose host, two RTL-SDR dongles, and production Zello credentials.
Use Node.js 26 or later and npm for local development.

## Setup

Run `npm ci` for development. For deployment, copy `.env.example` to `.env.pd` and `.env.fd`, set
both files to mode `600`, and fill in channel values. See [the setup guide](docs/radio-server.md).

## Usage

Start the bridge with `docker compose up -d --build`. Read [release notes](RELEASE_NOTES.md) for
changes. Find operating details in [the guide](docs/README.md) and repository rules in
[specifications](specs/README.md).

## Development

Read [AGENTS.md](AGENTS.md) before changing source files. Implementation lives in `src/`, launchers
in `bin/`, and tests in `tests/`.

## Testing

Run `npm test` for repository validation. Run `npm run lint` and `npm run audit` for focused checks.
Run `npm run format` to apply formatting and `npm run format:check` to check it.

## Troubleshooting

See [troubleshooting guidance](docs/radio-server.md#troubleshooting) and inspect `docker compose`
logs. `/health` shows if the status server responds. `/ready` shows if the receiver
and both Zello sessions are online.

## Security

Keep `.env.pd` and `.env.fd` private. They hold account passwords and signing keys. Git and the
Docker build context exclude these files.

## Configuration

Channel files define Zello accounts, signing keys, SDR devices, frequencies, CTCSS tones, UDP
numbers, and RNNoise level. See [all settings](docs/radio-server.md#channel-settings).

## Operations

See [container operations](docs/radio-server.md#operations) for start, update, logging, and stop
commands.

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
