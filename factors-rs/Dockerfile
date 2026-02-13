# Build stage
FROM rust:1.75-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Cache dependencies (speeds up rebuilds)
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source
COPY src ./src

# Build application
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Create factor logs directory
RUN mkdir -p /app/factor_logs

# Copy binary from builder
COPY --from=builder /app/target/release/factors-rs /usr/local/bin/

WORKDIR /app

EXPOSE 8000

ENV RUST_LOG=info,factors_rs=debug
ENV PORT=8000
ENV FACTOR_LOGS_DIR=/app/factor_logs

CMD ["factors-rs"]
