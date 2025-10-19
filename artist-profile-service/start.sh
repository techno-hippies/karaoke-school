#!/bin/bash
set -e

# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Start the server from artist-profile-service directory
cd /opt/render/project/src/artist-profile-service
exec node server.mjs
