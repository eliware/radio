FROM node:26-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends icecast2 \
    && rm -rf /var/lib/apt/lists/*
COPY src/service-supervisor.mjs src/icecast-config.mjs /app/src/
COPY bin/icecast-supervisor.mjs /app/bin/
WORKDIR /app
USER icecast2
EXPOSE 8000 9102
CMD ["node", "bin/icecast-supervisor.mjs"]
