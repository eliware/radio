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

Radio forwards local NBFM receiver audio to matching Zello channels. It can also send processed
audio to optional Broadcastify Classic feeds.

## Requirements

Run the container on a Linux host with Docker Engine, the Docker Compose plugin, and an RTL-SDR
device. Provide production Zello credentials for each destination channel.

## Setup

Copy `.env.example` to `.env`. Set its file mode to `600`. Follow the
[installation guide](docs/radio-server.md#setup).

## Usage

Read the [end-user guide](docs/README.md) and its [radio bridge manual](docs/radio-server.md).
Read [release notes](RELEASE_NOTES.md) for version changes. Read [specifications](specs/README.md)
for repository contracts.

## Development

Use Node.js 26 or later. Read the [contributor instructions](AGENTS.md) for development setup and
validation commands. Follow the [direct startup guide](docs/radio-server.md#operations) to run the
application outside Compose.

## Testing

Run `npm test` to validate the repository. Read [AGENTS.md](AGENTS.md) for focused test commands.

## Troubleshooting

Follow the [troubleshooting guide](docs/radio-server.md#troubleshooting). Check `/health` for
component state and `/ready` for overall readiness.

## Security

Keep channel files private because they contain account passwords and signing keys. Do not commit
credentials or share configuration files.

## Configuration

Read the [channel settings reference](docs/radio-server.md#channel-settings) for required values,
defaults, and accepted ranges.

## Operations

Run `npm run deploy:compose` to build and start the local container. Follow the
[container operations guide](docs/radio-server.md#operations) to inspect, start, or stop it.

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
