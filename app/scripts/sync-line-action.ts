#!/usr/bin/env bun

/**
 * Sync line-level Lit Action config from lit-actions into the app
 * - Reads CID from lit-actions/cids/<env>.json
 * - Reads encrypted Voxtral key from lit-actions/keys/<env>/karaoke-line/voxtral_api_key_karaoke-line.json
 * - Writes to app/.env.local and updates src/lib/contracts/addresses.ts with the encrypted key
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_APP = join(__dirname, '..')
const ROOT_LIT = join(__dirname, '../../lit-actions')

const ENV = process.env.LIT_ENV || process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
const CID_PATH = join(ROOT_LIT, 'cids', `${ENV}.json`)
const KEY_PATH = join(ROOT_LIT, 'keys', ENV, 'karaoke-line', 'voxtral_api_key_karaoke-line.json')
const ENV_LOCAL = join(ROOT_APP, '.env.local')
const ADDRESSES_PATH = join(ROOT_APP, 'src', 'lib', 'contracts', 'addresses.ts')

function main() {
  if (!existsSync(CID_PATH)) {
    throw new Error(`CID file not found: ${CID_PATH} (run upload-action.ts karaoke-line)`) }
  if (!existsSync(KEY_PATH)) {
    throw new Error(`Encrypted key not found: ${KEY_PATH} (run encrypt-key.ts --action=karaoke-line --type=voxtral)`) }

  const cidJson = JSON.parse(readFileSync(CID_PATH, 'utf-8'))
  const lineCid = cidJson['karaoke-line']
  if (!lineCid) throw new Error(`CID missing for karaoke-line in ${CID_PATH}`)

  const keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf-8'))
  if (!keyJson.ciphertext || !keyJson.dataToEncryptHash || !keyJson.accessControlConditions) {
    throw new Error('Encrypted key payload missing required fields')
  }

  // Update .env.local
  let envLocal = ''
  if (existsSync(ENV_LOCAL)) envLocal = readFileSync(ENV_LOCAL, 'utf-8')
  const lines: string[] = envLocal.split(/\r?\n/).filter(Boolean)
  const set = (k: string, v: string) => {
    const idx = lines.findIndex((l) => l.startsWith(`${k}=`))
    if (idx >= 0) lines[idx] = `${k}=${v}`
    else lines.push(`${k}=${v}`)
  }
  set('VITE_KARAOKE_LINE_CID', lineCid)
  writeFileSync(ENV_LOCAL, lines.join('\n') + '\n')
  console.log(`✅ Updated .env.local (VITE_KARAOKE_LINE_CID=${lineCid})`)

  // Update addresses.ts (replace LIT_KARAOKE_LINE_VOXTRAL_KEY assignment)
  let addresses = readFileSync(ADDRESSES_PATH, 'utf-8')
  const keyString = JSON.stringify(keyJson, null, 2)
  addresses = addresses.replace(
    /export const LIT_KARAOKE_LINE_VOXTRAL_KEY = [\s\S]*?\n(?=export const|$)/m,
    `export const LIT_KARAOKE_LINE_VOXTRAL_KEY = ${keyString}\n\n`
  )
  if (!addresses.includes('LIT_KARAOKE_LINE_VOXTRAL_KEY')) {
    // Fallback: append
    addresses += `\nexport const LIT_KARAOKE_LINE_VOXTRAL_KEY = ${keyString}\n`
  }
  writeFileSync(ADDRESSES_PATH, addresses)
  console.log('✅ Updated src/lib/contracts/addresses.ts with encrypted line Voxtral key')
}

main()
