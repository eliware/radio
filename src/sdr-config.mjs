function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} must be set`);
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`${key} contains invalid characters`);
  return value;
}

function numberSetting(env, key) {
  const value = Number(env[key]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a positive number`);
  if (key.endsWith("_FREQUENCY_MHZ") && (value < 24 || value > 1766)) {
    throw new Error(`${key} must be from 24 through 1766 MHz`);
  }
  if (key.endsWith("_PL_HZ") && (value < 67 || value > 254.1)) {
    throw new Error(`${key} must be from 67 through 254.1 Hz`);
  }
  return value;
}

function device({ serial, frequency, tone, mount, password }) {
  return `{ type = "rtlsdr"; serial = "${serial}"; gain = 25; sample_rate = 1.024;
    centerfreq = ${frequency};
    channels: ({ freq = ${frequency}; modulation = "nfm"; ctcss = ${tone};
      notch = ${tone}; outputs: ({
      type = "icecast"; server = "icecast"; port = 8000; mountpoint = "${mount}.mp3";
      username = "source"; password = "${password}";
    }); }); }`;
}

export function createSdrConfig(env, channel = "both") {
  if (!["both", "police", "fire"].includes(channel)) throw new Error("Unknown receiver channel");
  const password = required(env, "ICECAST_SOURCE_PASSWORD");
  if (!/^[a-zA-Z0-9_-]{16,}$/.test(password)) {
    throw new Error(
      "ICECAST_SOURCE_PASSWORD must use at least 16 letters, digits, underscores, or hyphens",
    );
  }
  const policeSerial = required(env, "RADIO_POLICE_SDR_SERIAL");
  const fireSerial = required(env, "RADIO_FIRE_SDR_SERIAL");
  if (policeSerial === fireSerial) throw new Error("Police and fire need different SDR serials");
  const policeTone = numberSetting(env, "RADIO_POLICE_PL_HZ").toFixed(1);
  const fireTone = numberSetting(env, "RADIO_FIRE_PL_HZ").toFixed(1);
  const police = device({
    serial: policeSerial,
    frequency: numberSetting(env, "RADIO_POLICE_FREQUENCY_MHZ"),
    tone: policeTone,
    mount: "police",
    password,
  });
  const fire = device({
    serial: fireSerial,
    frequency: numberSetting(env, "RADIO_FIRE_FREQUENCY_MHZ"),
    tone: fireTone,
    mount: "fire",
    password,
  });
  const devices = channel === "police" ? police : channel === "fire" ? fire : `${police}, ${fire}`;
  return `fft_size = 256; devices: (${devices});`;
}
