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

Radio forwards local NFM channels to matching Zello channels. It can also send processed audio to Broadcastify Classic.

## Requirements

Run the app on a Linux host with Docker Compose and an RTL-SDR dongle. Provide production Zello credentials.
Use Node.js 26 or later and npm for development.

## Setup

Copy `.env.example` to `.env` and set its mode to `600`. Fill in the channel values.
See [the setup guide](docs/radio-server.md) to add channels.

## Usage

Read [release notes](RELEASE_NOTES.md) for changes. Find user instructions in [the guide](docs/README.md).
Read [specifications](specs/README.md) for repository contracts.

## Development

Install dependencies with `npm ci`. Follow [contributor instructions](AGENTS.md).

## Testing

Run `npm test` for repository validation.

## Troubleshooting

See [troubleshooting guidance](docs/radio-server.md#troubleshooting). Check `/health` and `/ready` for application status.

## Security

Keep channel files private. They contain account passwords and signing keys.

## Configuration

See [channel settings](docs/radio-server.md#channel-settings) for each channel value.

## Operations

Use `npm run deploy:compose` to build and start the local container. See [container operations](docs/radio-server.md#operations) for other commands.

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
