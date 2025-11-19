#!/bin/bash

# Test structured output support for Gemini 2.5 Flash Lite

OPENROUTER_KEY=$OPENROUTER_API_KEY

echo "Testing google/gemini-2.5-flash-lite-preview-09-2025 with structured outputs..."

curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_KEY" \
  -H "X-Title: Test Structured Output" \
  -H "HTTP-Referer: https://karaoke.school" \
  -d '{
    "model": "google/gemini-2.5-flash-lite-preview-09-2025",
    "messages": [
      {
        "role": "user",
        "content": "Analyze this song: ABBA - Dancing Queen. Return structured data."
      }
    ],
    "temperature": 0,
    "max_tokens": 500,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "song_analysis",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "artist": { "type": "string" },
            "title": { "type": "string" },
            "genre": { "type": "string" },
            "isMatch": { "type": "boolean" }
          },
          "required": ["artist", "title", "genre", "isMatch"],
          "additionalProperties": false
        }
      }
    }
  }' | jq '.'
