# Release Notes

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
