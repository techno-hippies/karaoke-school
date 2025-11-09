import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../api-services/audio-download-service/.env")
];

envPaths.forEach((envPath, index) => {
  if (existsSync(envPath)) {
    config({ path: envPath, override: index === 0 });
  }
});

export {};
