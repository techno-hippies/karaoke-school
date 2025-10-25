#!/bin/bash
# Direct test of Quansic API

echo "Testing Macklemore ISNI: 0000000388129177"
echo "Please paste your Quansic session cookie when prompted:"
read -r COOKIE

curl -v "https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::0000000388129177" \
  -H "cookie: $COOKIE" \
  -H "accept: application/json" \
  -H "user-agent: Mozilla/5.0"
