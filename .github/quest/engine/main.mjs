// Entry point for the Quest Engine workflow: reads the GitHub event and runs
// it through the game.
import { readFileSync, readdirSync } from 'node:fs'
import { makeClient } from './github.mjs'
import { run } from './engine.mjs'

const here = (p) => new URL(p, import.meta.url)
const config = JSON.parse(readFileSync(here('../config.json'), 'utf8'))
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')

const questFiles = readdirSync(here('../quests/'))
function readBody(i, id) {
  const name = `${String(i).padStart(2, '0')}-${id}.md`
  if (!questFiles.includes(name)) throw new Error(`Missing quest file quests/${name}`)
  return readFileSync(here(`../quests/${name}`), 'utf8')
}

const gh = makeClient({ token: process.env.GITHUB_TOKEN, owner, repo, apiUrl: process.env.GITHUB_API_URL })
await run({ gh, event, eventName: process.env.GITHUB_EVENT_NAME, config, readBody })
