FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

# System deps
RUN apt-get update && apt-get install -y curl tmux ca-certificates && rm -rf /var/lib/apt/lists/*

# Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Codex CLI
RUN npm install -g @openai/codex

# Omnara
RUN curl -fsSL https://omnara.com/install.sh | bash

ENV PATH="/root/.omnara/bin:$PATH"

CMD ["omnara"]
