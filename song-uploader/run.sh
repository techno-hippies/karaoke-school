#!/bin/bash
# Song uploader runner with dotenvx
export DOTENV_PRIVATE_KEY='3d06cdd93c4f5f793cbabc013d5ae3404c2bd3d92ae8e6384df7b18594e45e1d'
dotenvx run -- bun run "$@"