# Radio-to-Zello bridge

Compose runs one `radio` container. Node.js runs as PID 1 and supervises RTLSDR-Airband and both
Zello WebSocket sessions. Audio moves to Zello only while its configured CTCSS squelch is open.

## Channel settings

Store Police and Fire settings in `.env.pd` and `.env.fd`. Each file names the Zello channel and
login, signing issuer and private key, SDR serial, frequency, CTCSS value, and startup test tone.
Keep both files private with mode `600`. Compose mounts them read-only. They are excluded from
Git and from the Docker build context.

The receiver requires two distinct SDR serials. It checks for both devices before launching the
single Airband process. Airband applies NFM demodulation and CTCSS filtering. It uses a 20 dB tuner
amplification, an 8 kHz channel filter, and 300 µs de-emphasis.

It sends 16 kHz mono float PCM to a loopback
UDP socket. Node converts samples to signed PCM and resamples them to 48 kHz. RNNoise keeps its own
state for each channel. Zello receives mono Opus at 48 kHz.

## Zello connections

Node signs production JWTs from each issuer and private key. It keeps a separate WebSocket
connected for each channel. Connections stay open between transmissions. Disconnections cause an
exponential retry interval capped at five minutes. A channel's one-second configured test tone is
sent once after its first correct login during container startup.

## Status and operations

The container exposes `/health` and `/ready` on port `1400`, published on localhost only.
`/health` confirms that the process responds. `/ready` returns success only while Airband runs and
both Zello sessions are connected and logged in.

Logs are timestamped JSON records with `debug`, `info`, `warn`, and `error` levels. Set `LOG_LEVEL`
to set the minimum output level. The default is `info`. Radio redacts credential fields and
known values from the loaded channel files before writing log records.

Runtime file paths use the shared ESM path helpers. Set `RADIO_CONFIG_DIR` to change the directory
that holds the mounted channel files. The temporary receiver config uses the platform's temporary
directory.

Run `docker compose up -d --build` to build and start the bridge. Read output with
`docker compose logs -f radio`. Run `docker compose down` to stop it.
