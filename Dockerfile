# Stage 1: compile simc binary
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y \
    g++ make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY engine/ ./engine/
COPY vs/ ./vs/

# Build 64-bit simc binary
RUN cd engine && make BITS=64 install

# Stage 2: runtime image
FROM node:20-slim

WORKDIR /app

# Copy compiled simc binary
COPY --from=builder /build/simc ./simc
RUN chmod +x ./simc

# Install backend dependencies
COPY backend/package.json ./backend/
RUN cd backend && npm install --production

COPY backend/ ./backend/

ENV PORT=3000
EXPOSE 3000

CMD ["node", "backend/server.js"]
