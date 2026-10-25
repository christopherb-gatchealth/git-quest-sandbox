import { createHash, randomInt } from 'node:crypto'

// Branch names the team uses: a type prefix, then a short lowercase slug.
export const BRANCH_RE = /^(feat|fix|chore)\/[a-z0-9][a-z0-9._-]*$/

// What the secret scan looks for. Keep in sync with .github/workflows/secret-scan.yml.
export const SECRET_RE = /QUEST_SECRET_[A-Z0-9]{20}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----/

export const RANKS = [
  ['Intern', 0],
  ['Committer', 400],
  ['Reviewer', 1000],
  ['Maintainer', 1600],
]

export const HINT_COST = 0.1 // share of a quest's XP each hint costs
export const SPEEDRUN_MS = 10 * 60 * 1000

export function rankFor(xp) {
  let rank = RANKS[0][0]
  for (const [name, min] of RANKS) if (xp >= min) rank = name
  return rank
}

export const branchOf = (ref) => (ref || '').replace(/^refs\/heads\//, '')

// Branches the bot owns or uses for bookkeeping; the player's work is everything else.
export const isPlayerBranch = (b) => !!b && b !== 'main' && b !== 'quest-state' && !b.startsWith('bot/')

// The code ./quest prints for a lab. Same recipe as code_for() in the quest script.
export function labCode(lab, login) {
  return createHash('sha256').update(`git-quest:${lab}:${login.toLowerCase()}`).digest('hex').slice(0, 8)
}

export function fakeSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 20; i++) s += chars[randomInt(chars.length)]
  return `QUEST_SECRET_${s}`
}

// Returns the names of the PR template sections that are missing or still empty.
export function missingSections(body) {
  const sections = { what: '', why: '', 'how i tested': '' }
  const text = (body || '').replace(/<!--[\s\S]*?-->/g, '')
  for (const part of text.split(/^##\s+/m).slice(1)) {
    const [head, ...rest] = part.split('\n')
    const key = head.trim().toLowerCase()
    if (key in sections) sections[key] = rest.join('\n').trim()
  }
  return Object.entries(sections).filter(([, v]) => v.length < 10).map(([k]) => k)
}

export function titleProblems(title) {
  const t = (title || '').trim()
  const problems = []
  if (t.split(/\s+/).filter(Boolean).length < 3) problems.push('Use at least 3 words, saying what the change does.')
  if (/^update\s+\S+$/i.test(t) || /^update\s+\S+\.\w+$/i.test(t)) problems.push('"Update <file>" says which file, not what changed. Describe the change instead.')
  if (t && t[0] !== t[0].toUpperCase()) problems.push('Start the title with a capital letter.')
  return problems
}

export function prProblems(pr) {
  const out = titleProblems(pr.title)
  const missing = missingSections(pr.body)
  if (missing.length) out.push(`Fill in the description template. Missing or too short: ${missing.map((m) => `"${m}"`).join(', ')}.`)
  return out
}

// True when any line a patch adds contains something that looks like a secret.
export function patchAddsSecret(patch) {
  return (patch || '').split('\n').some((l) => l.startsWith('+') && SECRET_RE.test(l))
}

export function render(template, vars) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars)
    return v == null ? m : String(v)
  })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
