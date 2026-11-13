FROM node:26-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash build-essential cmake git pkg-config linux-libc-dev ca-certificates \
    libmp3lame-dev libshout3-dev libconfig++-dev libfftw3-dev libusb-1.0-0-dev \
    libpulse-dev libsoapysdr-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
ENV CMAKE_POLICY_VERSION_MINIMUM=3.5
RUN git clone --depth 1 https://github.com/rtlsdrblog/rtl-sdr-blog.git rtl-sdr-blog \
    && cmake -S rtl-sdr-blog -B rtl-sdr-blog/build -DCMAKE_INSTALL_PREFIX=/usr \
      -DDETACH_KERNEL_DRIVER=ON -DCMAKE_BUILD_TYPE=Release \
    && cmake --build rtl-sdr-blog/build -j4 \
    && cmake --install rtl-sdr-blog/build
RUN git clone --depth 1 --branch v5.1.0 \
    https://github.com/rtl-airband/RTLSDR-Airband.git RTLSDR-Airband-5.1.0 \
    && rm -rf RTLSDR-Airband-5.1.0/.git \
    && cmake -S RTLSDR-Airband-5.1.0 -B airband-build -DPLATFORM=generic \
      -DCMAKE_BUILD_TYPE=Release -DNFM=TRUE \
    && cmake --build airband-build -j4

FROM node:26-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg libstdc++6 libmp3lame0 libshout3 libconfig++9v5 \
    libfftw3-single3 libusb-1.0-0 libpulse0 libsoapysdr0.8 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/lib/x86_64-linux-gnu/librtlsdr.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /build/airband-build/src/rtl_airband /usr/local/bin/rtl_airband
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src/ ./src/
COPY bin/radio.mjs ./bin/radio.mjs
EXPOSE 1400
CMD ["node", "bin/radio.mjs"]
