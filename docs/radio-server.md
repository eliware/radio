# Radio-to-Zello bridge

Radio forwards two local NBFM receiver channels to separate Zello channels. The app runs in one
Docker container and supervises RTLSDR-Airband, audio processing, and both Zello connections.

## What it does

Each receiver uses its configured SDR serial, frequency, and CTCSS tone. RTLSDR-Airband applies
NFM demodulation, CTCSS detection, notch filtering, and de-emphasis. It sends audio while the
configured CTCSS squelch is open.

Node.js receives 16 kHz mono float audio from RTLSDR-Airband using loopback UDP. It converts and
resamples the signal to 48 kHz, applies RNNoise, and sends mono Opus to the matching Zello channel.
Each channel has its own denoiser state and WebSocket connection. The connection stays open between
transmissions. The app ends a Zello transmission after 500 ms without audio.

After a channel first connects during container startup, the app sends its configured one-second
test tone. This confirms that the channel can receive audio from the bridge.

## Requirements

- A Linux host with Docker Engine and the Docker Compose plugin.
- Two RTL-SDR dongles with distinct serial numbers, connected to the host.
- Antennas and valid frequency and CTCSS settings for both channels.
- A Zello account and production signing credentials for each destination channel.
- Network access from the container to Zello using TLS WebSockets.

Direct USB access uses `/dev/bus/usb`. The Compose file passes that device tree into the container.
The app does not provide a web audio player or Icecast server. Listen through the configured Zello
channels.

## Setup

From the repository root, create one channel file for Police and one for Fire:

```sh
cp .env.example .env.pd
cp .env.example .env.fd
chmod 600 .env.pd .env.fd
```

Edit each file with the matching channel account and SDR settings. Set distinct `SDR_SERIAL` and
`UDP_PORT` values. Use the exact Zello channel name and the production `ISSUER` and `PRIVATE_KEY`
from that channel's developer credentials. Do not use a sample development token.

Keep both files private. They contain account passwords and private signing keys. Git and the Docker
build context exclude them. Compose mounts them read-only inside the container.

Start the bridge and check its state:

```sh
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:1400/health
curl http://127.0.0.1:1400/ready
```

The first build compiles RTLSDR-Airband and installs the Node.js dependencies. Startup needs a
short interval while USB devices are detected and Zello connections are made. The one-second tones
play after the Zello sessions connect.

## Channel settings

Each channel file is a Node.js dotenv-style file. Keep PEM keys inside quoted multiline values.
The table lists the app's validation rules.

| Key             | Required | Meaning and accepted values                                      |
| --------------- | -------- | ---------------------------------------------------------------- |
| `CHANNEL`       | Yes      | Exact destination channel name in Zello.                         |
| `USERNAME`      | Yes      | Zello account name for this channel.                             |
| `PASSWORD`      | Yes      | Password for the Zello account.                                  |
| `ISSUER`        | Yes      | Issuer value for the production signing key.                     |
| `PRIVATE_KEY`   | Yes      | PEM private key used to sign a production JWT.                   |
| `SDR_SERIAL`    | Yes      | RTL-SDR serial number. Each channel file needs a unique value.   |
| `FREQUENCY_MHZ` | Yes      | Receive frequency from 24 through 1766 MHz.                      |
| `CTCSS_HZ`      | Yes      | CTCSS tone from 67 through 254.1 Hz.                             |
| `TONE`          | Yes      | Startup test tone from 200 through 3000 Hz.                      |
| `UDP_PORT`      | Yes      | Unique local UDP number from 1024 through 65535.                 |
| `RNNOISE`       | No       | Percent of noise-reduced audio from 0 through 100. Default: 100. |
| `PUBLIC_KEY`    | No       | Reference value only. The app does not read it.                  |

`RNNOISE=100` sends fully noise-reduced audio. `RNNOISE=80` combines 80% noise-reduced audio with
20% unprocessed audio. Lower values preserve more receiver noise along with the voice.

Do not set `TOKEN`. The app rejects it and signs production JWTs from `ISSUER` and `PRIVATE_KEY`.
The `PUBLIC_KEY` entry in the template is for reference and is not needed at runtime.

## Startup and recovery

Node.js starts as the container's PID 1 process. It validates both channel files before opening
connections, writes an RTLSDR-Airband configuration to a temporary directory, and opens one UDP
listener for each configured `UDP_PORT`.

The app starts Zello reconnection and RTLSDR-Airband independently. It waits for both configured
USB serials to appear. If a dongle is missing, it checks again every two seconds. If Airband exits,
the retry interval increases from one to 30 seconds. Each Zello session reconnects at intervals
that increase to five minutes. A stable Zello session resets its retry interval.

Airband uses 20 dB of tuner amplification, a 1.024 MHz sample rate, an 8 kHz NFM channel filter, and 300 µs
de-emphasis. It sends mono 16 kHz float audio to `127.0.0.1` at each channel's `UDP_PORT`.

## Health and readiness

Compose publishes the status server on `127.0.0.1:1400`, so it is available on the host only.
The two HTTP routes return JSON:

- `GET /health` returns HTTP 200 while the Node.js status server responds.
- `GET /ready` returns HTTP 200 only when RTLSDR-Airband is running and both Zello sessions are
  online. It returns HTTP 503 while startup or recovery is in progress.
- Other paths return HTTP 404.

Both status responses include the receiver state and each channel's connection state. Docker's
health check uses `/ready` and allows a 30-second startup period.

## Operations

```sh
docker compose up -d --build   # Build the image and start or update the app.
docker compose ps              # Show container and health state.
docker compose logs -f radio   # Follow app and RTLSDR-Airband logs.
docker compose restart radio   # Restart after editing .env.pd or .env.fd.
docker compose down            # Stop and remove the container.
```

Channel files are mounted at container startup. Starting the container again applies their changes.
A new image build is not needed. After changing `compose.yaml`, use `docker compose up -d` so Compose
recreates the container with the updated settings. Use `docker compose up -d --build` after source
or image changes.

Compose sets `LOG_LEVEL` to `info`. Supported levels are `debug`, `info`, `warn`, and `error`. To
change it, edit `LOG_LEVEL` in `compose.yaml` and run `docker compose up -d`. A simple stop and start
does not apply changed Compose environment values. Logs use timestamped JSON for Node.js messages.
RTLSDR-Airband writes its own text messages to the same container log.

To use a non-default channel-file directory, set `RADIO_CONFIG_DIR`. It must contain `police.env` and
`fire.env`. The status listener uses `RADIO_HEALTH_PORT`, which defaults to `1400`. If changing it,
also update the published host mapping and health-check URL in `compose.yaml`.

## Troubleshooting

| Symptom                              | Checks                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/ready` reports unavailable         | Read `docker compose logs --tail=100 radio`. Check receiver and channel states in the JSON response.                                   |
| Receiver waits for SDR devices       | Confirm both dongles are connected and their serials match `SDR_SERIAL`. Check USB access on the Linux host.                           |
| A Zello channel stays offline        | Check the channel name, username, password, issuer, private key, and container network access.                                         |
| A channel is online but has no audio | Check frequency, antenna, CTCSS tone, dongle serial, and the UDP port pair. Confirm Airband logs show output to the configured number. |
| Voice sounds too filtered            | Lower `RNNOISE` to keep more unprocessed signal, then start the container again.                                                       |
| Config validation fails              | Check required keys, numeric ranges, unique SDR serials and UDP numbers, and PEM formatting. Remove any `TOKEN` entry.                 |

Brief `[R82XX] PLL not locked!` output can appear while an SDR tuner starts. Look for later device
initialization messages. If a device does not initialize, `/ready` stays unsuccessful until the
receiver recovers.

The logger redacts credential fields and known channel-file values. Inspect logs before sharing
them. Do not share `.env.pd` or `.env.fd`.
