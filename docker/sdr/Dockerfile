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
RUN apk add --no-cache ca-certificates libstdc++ lame-libs libshout libconfig++ \
    fftw-single-libs libusb libpulse soapy-sdr
COPY --from=build /usr/lib/librtlsdr.so* /usr/lib/
COPY --from=build /build/airband-build/src/rtl_airband /usr/local/bin/rtl_airband
COPY src/service-supervisor.mjs src/sdr-config.mjs /app/src/
COPY bin/sdr-supervisor.mjs /app/bin/
WORKDIR /app
EXPOSE 9101
CMD ["node", "bin/sdr-supervisor.mjs"]
