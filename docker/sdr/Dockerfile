FROM node:26-alpine AS build

RUN apk add --no-cache bash build-base cmake git pkgconf linux-headers ca-certificates \
    lame-dev libshout-dev libconfig-dev fftw-dev libusb-dev pulseaudio-dev soapy-sdr-dev
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

FROM node:26-alpine
RUN apk add --no-cache ca-certificates ffmpeg libstdc++ lame-libs libshout libconfig++ \
    fftw-single-libs libusb libpulse soapy-sdr
RUN mkdir -p /usr/share/ffmpeg/arnndn \
    && wget -q https://raw.githubusercontent.com/richardpl/arnndn-models/0fda24c46d78f0207d820bb970fbe85c1971b39c/std.rnnn \
      -O /usr/share/ffmpeg/arnndn/std.rnnn \
    && echo "6b8943dc4a9b6b24425873992a44f29c0577503276456af46a8854774faeb294  /usr/share/ffmpeg/arnndn/std.rnnn" \
      | sha256sum -c -
COPY --from=build /usr/lib/librtlsdr.so* /usr/lib/
COPY --from=build /build/airband-build/src/rtl_airband /usr/local/bin/rtl_airband
COPY src/receiver-supervisor.mjs src/sdr-config.mjs src/audio-processing.mjs src/usb-device.mjs /app/src/
COPY bin/sdr-supervisor.mjs /app/bin/
WORKDIR /app
EXPOSE 9101
CMD ["node", "bin/sdr-supervisor.mjs"]
