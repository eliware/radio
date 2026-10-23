# Radio containers

Compose starts three private containers. `radio` serves the player on TCP port `3000` by default.
This host's local `.env` sets `PORT=3001` because Radar uses port `3000`.
`sdr` runs RTLSDR-Airband with two dongles, NFM demodulation, and configured CTCSS squelch.
`icecast` receives each audio source and serves its mountpoints to the player.
Each dongle samples at 1.024 Msps to lower USB traffic while covering its single channel.

The SDR and Icecast containers run Node as PID 1. Their supervisors expose `/health` and
`/ready` on internal ports `9101` and `9102`. `/health` confirms that the supervisor responds.
`/ready` also checks its child process and required downstream application. The SDR container
health check uses `/health`. Its `/ready` route stays unavailable until receiver configuration
and hardware are available.

The player forwards both Icecast streams under its own address.

Set the spare dongle serials in `.env` as `RADIO_POLICE_SDR_SERIAL` and
`RADIO_FIRE_SDR_SERIAL`. Do not use the Radar dongle with serial `1090`. The radio frequencies
require separate dongles because they are too far apart for one RTL-SDR. Set
`ICECAST_SOURCE_PASSWORD` to a private value of at least 16 characters. The frequencies and PL
tones are in local `.env`. Keep that file private and untracked.

Run `docker compose up -d --build` to start the containers. On this host, check the player at
`http://localhost:3001`, then use its Police and Fire audio controls. Check
`http://localhost:3001/health` and `/ready`. The SDR stays unready until both serial numbers
are configured and its receiver process is running. Use `docker compose logs -f sdr icecast`
to find startup problems. Run `docker compose down` to stop the containers.

Only the player port is published on the host. Icecast and both supervisor ports stay on the
Compose network. USB access is passed to the SDR container through `/dev/bus/usb`.
