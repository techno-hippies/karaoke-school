#!/bin/bash
cd /media/t42/th42/Code/karaoke-school-v1/lit-actions
timeout 300s dotenvx run -f .env -- node src/test/get-tx-hash.js
