# Radio-to-Zello bridge

Radio forwards one or more local NBFM receiver channels to separate Zello channels. One Docker
container runs the Node.js supervisor, RTLSDR-Airband, audio processing, and all Zello connections.
The image uses CentOS Stream 10 with Node.js 26 from the Eliware CentOS 10 Node.js base image.

## What it does

Each receiver uses its configured SDR serial, frequency, and CTCSS tone. Channels can share a
dongle when they use the same serial and amplification, and their frequencies span no more than 2.4 MHz.
RTLSDR-Airband applies NFM demodulation, CTCSS detection, notch filtering, and de-emphasis. It sends
audio while the configured CTCSS squelch is open.

Node.js receives 16 kHz mono float audio from RTLSDR-Airband using loopback UDP. It converts and
resamples the signal to 48 kHz, applies RNNoise, and sends mono Opus to the matching Zello channel.
Each channel has its own denoiser state and WebSocket connection. The connection stays open between
transmissions. The app ends a Zello transmission after 500 ms without audio.

After a channel first connects during container startup, the app sends its configured one-second
test tone. This confirms that the channel can receive audio from the bridge.

## Requirements

- A Linux host with Docker Engine and the Docker Compose plugin.
- At least one RTL-SDR dongle, connected to the host.
- An antenna and valid frequency and CTCSS settings for each channel.
- A Zello account and production signing credentials for each destination channel.
- Network access from the container to Zello using TLS WebSockets.

Direct USB access uses `/dev/bus/usb`. The Compose file passes that device tree into the container.
The app does not provide a web audio player or Icecast server. Listen through the configured Zello
channels. Optional Broadcastify Classic outputs can publish the same post-RNNoise audio sent to
Zello, using the configured `RNNOISE` percentage. They remain disabled until Broadcastify approves the
account and provides technical connection values.

## Setup

The default Compose setup runs one channel. From the repository root, create its configuration:

```sh
cp .env.example .env
chmod 600 .env
```

Fill in its Zello account and SDR settings, then start the bridge with `docker compose up -d --build`.
To add a channel, copy `.env.example` to `.env.channel2`, fill in its settings, and set the file mode
to `600`.

Create an ignored `compose.override.yaml` that adds the channel file:

```yaml
services:
  radio:
    environment:
      RADIO_CONFIG_FILES: '["/run/radio/channel.env", "/run/radio/channel2.env"]'
    volumes:
      - ./.env.channel2:/run/radio/channel2.env:ro
```

The base Compose file mounts `.env` as `/run/radio/channel.env`. Add one read-only volume and
container path for every new channel file. Give each channel a unique `UDP_PORT`.
Channels sharing a dongle use matching `SDR_SERIAL` and `SDR_GAIN` values.

Channels with the same `SDR_SERIAL` share a dongle when their frequencies span at most 2.4 MHz. They
must use matching `SDR_GAIN` and distinct `UDP_PORT` values. `SDR_GAIN` controls tuner amplification
in dB. Begin with a low value. Use the exact Zello channel name and production `ISSUER`
and `PRIVATE_KEY` from its developer credentials. Do not use a sample development token.

Keep all channel files private. They contain account passwords and private signing keys. Git and the
Docker build context exclude them. Compose mounts them read-only inside the container.

Start the bridge and check its state:

```sh
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:1400/health
curl http://127.0.0.1:1400/ready
```

The first build compiles RTLSDR-Airband and installs the Node.js dependencies. Startup needs a
short interval while USB devices are detected and Zello connections are made. Each one-second tone
plays after its Zello session connects.
If a channel file is missing or invalid, startup exits before it opens connections. Fix the file,
then start the container again.

## Channel settings

Each channel file uses Node.js environment-file syntax. Keep PEM keys inside quoted multiline
values. Copy `.env.example` to see placeholders for required values. The table lists validation rules.

| Key                     | Required   | Meaning and accepted values                                      |
| ----------------------- | ---------- | ---------------------------------------------------------------- |
| `CHANNEL`               | Yes        | Exact destination channel name in Zello.                         |
| `USERNAME`              | Yes        | Zello account name for this channel.                             |
| `PASSWORD`              | Yes        | Password for the Zello account.                                  |
| `ISSUER`                | Yes        | Issuer value for the production signing key.                     |
| `PRIVATE_KEY`           | Yes        | PEM private key used to sign a production JWT.                   |
| `SDR_SERIAL`            | Yes        | RTL-SDR serial with letters, digits, underscores, or hyphens.    |
| `SDR_GAIN`              | No         | Tuner amplification from 0 to 49.6 dB. Default: 10.              |
| `FREQUENCY_MHZ`         | Yes        | Receive frequency from 24 through 1766 MHz.                      |
| `CTCSS_HZ`              | Yes        | CTCSS tone from 67 through 254.1 Hz.                             |
| `TONE`                  | Yes        | Startup test tone from 200 through 3000 Hz.                      |
| `UDP_PORT`              | Yes        | Unique local UDP port from 1024 through 65535.                   |
| `RNNOISE`               | No         | Percent of noise-reduced audio from 0 through 100. Default: 100. |
| `BROADCASTIFY_ENABLED`  | No         | Use lowercase `true` or `false`. Default: `false`.               |
| `BROADCASTIFY_HOST`     | If enabled | Icecast host name without a scheme or path.                      |
| `BROADCASTIFY_PORT`     | If enabled | Icecast source port from 1 through 65535.                        |
| `BROADCASTIFY_MOUNT`    | If enabled | Icecast source path, starting with `/`.                          |
| `BROADCASTIFY_PASSWORD` | If enabled | Source password from the Broadcastify Technicals page.           |
| `BROADCASTIFY_NAME`     | No         | Optional stream title. Defaults to `CHANNEL`.                    |
| `PUBLIC_KEY`            | No         | Reference value only. The app does not read it.                  |

`RNNOISE` must be an integer from 0 through 100. `RNNOISE=100` sends fully noise-reduced audio.
`RNNOISE=80` combines 80% noise-reduced audio with 20% unprocessed audio. `RNNOISE=0` sends the
unprocessed signal. Lower values preserve more receiver noise along with the voice.

The template uses `RNNOISE=80`. The runtime default is 100 when this value is omitted.

Each enabled Broadcastify output receives the same post-RNNoise processed audio that is encoded for
Zello. A separate FFmpeg process for each channel converts 48 kHz mono PCM to a 22.05 kHz, 16 kbps
mono MP3 source stream. Node keeps the source stream continuous by writing quiet audio between
transmissions. Keep Broadcastify disabled until it approves the account and provides its connection
values.

Do not set `TOKEN`. The app rejects it and signs production JWTs from `ISSUER` and `PRIVATE_KEY`.
The `PUBLIC_KEY` entry in the template is for reference and is not needed at runtime.
The app rejects channel settings that are not listed in the table.

## Runtime settings

These environment variables configure the application process or its HTTP status endpoint. They
are separate from the per-channel settings above.

| Variable                      | Required | Meaning and default                                                                                              |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `RADIO_CONFIG_FILES`          | No       | Non-empty JSON array of channel paths. Defaults to the application root `.env` file.                             |
| `RADIO_HEALTH_PORT`           | No       | HTTP status port. Defaults to `1400`. Accepts integers from `0` through `65535`.                                 |
| `RADIO_ZELLO_DEBUG_RESPONSES` | No       | Adds sanitized values to invalid Zello response logs. Defaults to `false` in the app. Compose sets it to `true`. |
| `LOG_LEVEL`                   | No       | Log verbosity: `debug`, `info`, `warn`, or `error`. Defaults to `info`.                                          |

A value of `0` lets the operating system select a port. The Compose health check expects port
`1400`, so keep the default when you use Compose. `RADIO_CONFIG_FILES` must contain one or more
non-empty file paths. For example, use `["/run/radio/channel.env", "/run/radio/channel2.env"]`.
The container default is `/app/.env`.

Compose enables detailed Zello response logs. The app removes known credentials and sensitive values
before it writes those logs. Set `RADIO_ZELLO_DEBUG_RESPONSES=false` in `compose.yaml` to disable them.

## Startup and recovery

Node.js starts as the container's PID 1 process. It validates every channel file before opening
connections, writes an RTLSDR-Airband configuration to a temporary directory, and opens one UDP
listener for each configured `UDP_PORT`.

The app starts Zello sessions, optional Broadcastify encoders, and RTLSDR-Airband independently.
It waits for every configured USB serial to appear. If a dongle is missing, it checks again every two
seconds. Airband retries increase from one to 30 seconds after failure.

Zello sessions close and reconnect after three invalid matching command replies in ten seconds. A
valid response resets this count. Retry delays double from one second to five minutes. They return to
one second after a connection stays healthy for 30 seconds. A recovering channel reports `degraded`.
The `/ready` route returns HTTP 503 until every channel recovers.

Broadcastify retries start at one second and double to five minutes. A stable process resets the
retry interval after 60 seconds. A failed Broadcastify process does not stop Zello audio or the other
channel output. The app suppresses repeated matching component errors for 60 seconds. Later error
reports include the suppression count and error details.

Airband groups channels by `SDR_SERIAL` and sets each dongle's center frequency between its lowest
and highest channel frequencies. It samples each dongle at 2.56 MHz, which allows a 2.4 MHz span.
It uses the shared `SDR_GAIN`, an 8 kHz NFM channel filter, and 300 µs de-emphasis. It sends mono
16 kHz float audio to `127.0.0.1` at each channel's `UDP_PORT`.

## Health and readiness

Compose publishes the status server on `127.0.0.1:1400`, so it is available on the host only.
The two HTTP routes return JSON:

- `GET /health` returns HTTP 200 while the Node.js status server responds.
- `GET /ready` returns HTTP 200 only when RTLSDR-Airband is running, every Zello session is
  online, each initial startup tone has completed, and each enabled Broadcastify FFmpeg process
  is running. It returns HTTP 503 during startup or recovery.
- Requests using methods other than `GET` to `/health` or `/ready` return HTTP 405.
- Other paths return HTTP 404.

Both status responses are JSON. They include receiver, channel, and Broadcastify states. Disabled
outputs report `disabled`. Receiver errors can appear in the status response. Check logs for Zello
or Broadcastify errors.

Readiness checks the FFmpeg process and its writable audio input. It does not confirm that a remote
Broadcastify server receives audio.

The `/health` route confirms that the status listener responds. It does not report radio readiness.
For example, a startup response can look like this:

```json
{
  "status": "not-ready",
  "receiver": { "state": "waiting-for-sdrs" },
  "channels": {
    "Police": { "state": "online" },
    "Fire": { "state": "connecting" }
  },
  "broadcastify": {
    "Police": { "state": "disabled" },
    "Fire": { "state": "disabled" }
  }
}
```

The channel names come from each `CHANNEL` value. The status listener binds to all container
interfaces. Compose publishes it on host loopback only. Docker checks `/ready` every 15 seconds and
allows a 30-second startup period before counting failures. After three failed checks, Docker marks
the container unhealthy. The health check does not start the container again by itself.

## Operations

Run the package script to build the image and start or update the local container:

```sh
npm run deploy:compose
```

To run outside Compose, install Node.js 26 or later and run `npm ci`. Provide the required channel
settings in `.env` or set `RADIO_CONFIG_FILES`. Install RTLSDR-Airband 5.1.0 and its shared runtime
libraries. Give the process access to the USB devices.

If you enable Broadcastify, install FFmpeg. Then run `npm start`. The status listener binds to all host
interfaces on the configured port. Use a firewall to limit access. Compose publishes the status port
on host loopback only.

Use these commands to inspect the container, start it again, follow its logs, or stop it:

```sh
docker compose ps              # Show container and health state.
docker compose logs -f radio   # Follow app and RTLSDR-Airband logs.
docker compose restart radio   # Restart after editing channel configuration files.
docker compose stop radio      # Stop the service without removing the container.
docker compose down            # Stop and remove the container.
```

Channel files are mounted at container startup. Start the container again after changing a channel file.
A new image build is not needed. After changing `compose.yaml`, use `docker compose up -d` so Compose
recreates the container with the updated settings. Use `docker compose up -d --build` after source
or image changes.

Compose sets `LOG_LEVEL` to `info`. Supported levels are `debug`, `info`, `warn`, and `error`. To
change it, edit `LOG_LEVEL` in `compose.yaml` and run `docker compose up -d`. A simple stop and start
does not apply changed Compose environment values. Logs use timestamped JSON for Node.js messages.
RTLSDR-Airband writes its own text messages to the same container log.

Channels sharing an SDR serial must set `SDR_GAIN` identically. Their frequencies can span at most
2.4 MHz. The app centers the dongle between their lowest and highest frequencies.

The status listener binds to all interfaces. Compose limits host access to loopback. If you change
the port, update the published host mapping and health-check URL in `compose.yaml`.

The app handles `SIGINT` and `SIGTERM`. It closes audio inputs, Zello sessions, optional Broadcastify
outputs, RTLSDR-Airband, and the status server. Use `docker compose stop` or `docker compose down` to
send a stop signal through Compose.

## Troubleshooting

| Symptom                              | Checks                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/ready` reports unavailable         | Read `docker compose logs --tail=100 radio`. Check receiver and channel states in the JSON response.                         |
| Receiver waits for SDR devices       | Confirm each configured dongle is connected and its serial matches `SDR_SERIAL`. Check USB access on the Linux host.         |
| A Zello channel stays offline        | Check its channel settings and network access. Read Zello errors in `docker compose logs radio`.                             |
| A Broadcastify stream stays offline  | Check its settings and FFmpeg logs. A `running` state does not prove the remote source is receiving audio.                   |
| A channel is online but has no audio | Check frequency, antenna, CTCSS tone, dongle serial, and UDP port. Confirm Airband logs show output to that port.            |
| Voice sounds too filtered            | Lower `RNNOISE` to keep more unprocessed signal, then start the container again.                                             |
| Config validation fails              | Check required keys, numeric ranges, unique UDP ports, shared dongle settings, and PEM formatting. Remove any `TOKEN` entry. |

Brief `[R82XX] PLL not locked!` output can appear while an SDR tuner starts. Look for later device
initialization messages. If a device does not initialize, `/ready` stays unsuccessful until the
receiver recovers.

The logger redacts credential fields and known channel-file values. Inspect logs before sharing
them. Do not share `.env` or other channel configuration files.
