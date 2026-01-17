FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install basic tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Ensure vscode user owns workspace
RUN chown -R vscode:vscode /workspace
