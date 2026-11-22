FROM ghcr.io/eliware/centos10-node26:latest AS build

USER 0
RUN dnf -y install epel-release dnf-plugins-core \
    && crb enable \
    && dnf -y --setopt=install_weak_deps=False --setopt=tsflags=nodocs install \
      bash ca-certificates cmake gcc gcc-c++ git kernel-headers make pkgconf-pkg-config \
      lame-devel libshout-devel libconfig-devel fftw-devel libusb1-devel \
      pulseaudio-libs-devel SoapySDR-devel \
    && dnf clean all
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

FROM ghcr.io/eliware/centos10-node26:latest
USER 0
ENV NODE_ENV=production
RUN dnf -y install epel-release dnf-plugins-core \
    && crb enable \
    && dnf -y --setopt=install_weak_deps=False --setopt=tsflags=nodocs install \
      ca-certificates ffmpeg-free lame-libs libshout libconfig fftw-libs-single \
      libusb1 pulseaudio-libs SoapySDR \
    && dnf clean all
COPY --from=build /usr/lib64/librtlsdr.so* /usr/lib64/
COPY --from=build /build/airband-build/src/rtl_airband /usr/local/bin/rtl_airband
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src/ ./src/
COPY bin/radio.mjs ./bin/radio.mjs
EXPOSE 1400
CMD ["node", "bin/radio.mjs"]
