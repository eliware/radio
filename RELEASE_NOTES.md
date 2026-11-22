# Release Notes

## 15.2.0 — 2026-11-22

### Added

- Adds the `deploy:compose` npm script to build and start the local container.
- Runs the Compose deployment script after tests on the NAS deployment target.

### Changed

- Documents the local Compose deployment command and container operations.
- Builds the Radio container with the Eliware CentOS 10 Node.js 26 base image.
- Aligns implementation modules with the `@eliware/test` 15.2.0 export conventions.
- Updates resolved development dependencies with `npm update`. `npm outdated` found no outdated direct dependencies.
- Sets the package version to 15.2.0.

## 15.1.0 — 2026-11-15

### Added

- Supports one or more channel configuration files. Shared-dongle channels require matching tuner amplification and frequencies spanning no more than 2.4 MHz.
- Adds a NAS deployment target that pulls the repository, installs dependencies, and runs the test suite.

### Changed

- Uses Node.js 26 on Debian Bookworm Slim for the radio container.
- Simplifies the base Compose setup to one `.env` channel file. Configure more private channel files with an ignored Compose override. Git and Docker build context exclude channel files and overrides.
- Updates `@eliware/resampler` to 15.1.0, `ws` to 8.23.0, and `@eliware/test` to 15.1.0, along with the resolved dependency updates in the lockfile.
- Expands the end-user guide for multi-channel setup, shared SDRs, channel settings, and health/readiness behavior.
- Refactors audio denoising and transmission, logging, configuration, radio startup, Airband, Broadcastify, Zello, and status-server code into focused modules.

### Fixed

- Preserves buffered audio and retries after Zello stream-start failures. Stops abandoned streams before starting replacements.
- Prevents stale Zello socket callbacks and logon requests from affecting replacement connections, validates command responses, and removes response listeners during connection cleanup.
- Restarts failed Broadcastify output pipes without replacing a child before it closes, and ensures stream and supervisor cleanup both run during shutdown.
- Closes constructed channel sessions when radio startup fails and cleans up failed status-server binds.
- Validates health-port values, finite Airband frequencies and tuner amplification values, and SDR serials before starting services or generating configuration.
- Redacts registered credentials from status responses and avoids leaking audio transmission or child-process resources when shutdown encounters errors.

## 15.0.1 — 2026-10-27

### Added

- Bridges two local NBFM receiver channels to their matching Zello channels through separate RTL-SDR devices.
- Configures receiver serials, tuner amplification, frequencies, CTCSS squelch tones, UDP ports, and startup test tones for each channel.
- Converts receiver audio to 48 kHz mono, applies adjustable RNNoise processing, and sends Opus audio to Zello.
- Optionally sends the processed channel audio to Broadcastify Classic through separate continuous MP3 source streams.
- Runs in Docker Compose with USB passthrough and loopback-only `/health` and `/ready` status endpoints.
- Documents installation, channel settings, runtime settings, operations, and troubleshooting.

### Changed

- Validates both channel files before startup. Checks required values and distinct receiver serials and UDP ports.
- Updated `@eliware/common` and `@eliware/resampler` to 15.0.1.

### Fixed

- Ends transmissions after 500 ms without audio and reconnects Zello sessions with increasing retry delays.
- Retries missing SDR detection, recovers from component failures, and closes audio and process resources during shutdown.

### Security

- Emits structured JSON logs and redacts credentials and known channel configuration values.
