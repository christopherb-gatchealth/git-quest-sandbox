// Plays the whole game against FakeGitHub: every quest, plus the usual
// beginner mistakes along the way, checking what the bot says and scores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { run } from '../engine.mjs'
import { labCode } from '../util.mjs'
import { FakeGitHub } from './fake-github.mjs'

const PLAYER = 'nirajkaushik22'
const config = { player: PLAYER, mentor: 'mentor' }
const readBody = (i, id) => readFileSync(new URL(`../../quests/${String(i).padStart(2, '0')}-${id}.md`, import.meta.url), 'utf8')

const TEMPLATE_OK = '## What\nAdds me to the players list.\n\n## Why\nSo the team knows who I am.\n\n## How I tested\nPreviewed the file on GitHub.'

function setup() {
  const gh = new FakeGitHub({
    'hello.md': '# Hello\n\n## Players\n',
    'about/README.md': '# About the team\n',
    'config/settings.md': 'theme: dark\nfavorite_editor: TBD\ntab_width: 2\n',
    '.gitignore': '.DS_Store\n',
  })
  let clock = Date.parse('2026-10-26T09:00:00Z')
  const now = () => new Date((clock += 15 * 60 * 1000)) // 15 min per step: no accidental speedruns
  const send = (eventName, payload, login = PLAYER) =>
    run({ gh, event: { ...payload, sender: { login } }, eventName, config, readBody, now, log: () => {} })
  const quest = () => gh.state.quests[gh.state.level]
  const issueOf = () => quest().issue

  // Commits on a branch (from its head, or from `from`) and sends the push event.
  async function push(branch, changes, { from, message = 'Change', username = PLAYER, forced = false, parents } = {}) {
    const head = gh.refs.get(branch)
    const ps = parents ?? [from ?? head ?? gh.refs.get('main')]
    const sha = gh.commit(ps, changes, message, username)
    gh.refs.set(branch, sha)
    // Like a real push that creates a branch: GitHub sends no commit list.
    await send('push', { ref: `refs/heads/${branch}`, after: sha, forced, deleted: false, commits: [] })
    const pr = [...gh.pulls.values()].find((p) => p.head.ref === branch && !p.merged)
    if (pr) {
      pr.head.sha = sha
      await send('pull_request', { action: 'synchronize', pull_request: pr })
    }
    return sha
  }
  const openPr = async (branch, title, body = TEMPLATE_OK, extra = {}) => {
    const pr = gh.openPull({ head: branch, title, body, login: PLAYER })
    Object.assign(pr, extra)
    await send('pull_request', { action: 'opened', pull_request: pr })
    return pr
  }
  const merge = async (pr) => send('pull_request', { action: 'closed', pull_request: gh.mergePull(pr.number) })
  const say = (body, issue = issueOf()) => send('issue_comment', { action: 'created', comment: { body }, issue: { number: issue } })

  return { gh, send, quest, issueOf, push, openPr, merge, say }
}

test('a full playthrough, mistakes included', async () => {
  const { gh, send, quest, issueOf, push, openPr, merge, say } = setup()

  // Start
  await send('workflow_dispatch', { inputs: { action: 'start' } }, 'mentor')
  assert.equal(gh.state.log_issue, 1)
  assert.match(gh.issues.get(2).body, /@nirajkaushik22 welcome/)
  assert.match(gh.issues.get(2).body, /git@github\.com:mentor\/git-quest\.git/)
  assert.match(gh.issues.get(2).body, /#1/)

  // Strangers are ignored
  await send('issue_comment', { action: 'created', comment: { body: '/hint' }, issue: { number: 2 } }, 'stranger')
  assert.equal(gh.issues.get(2).comments.length, 0)

  // Quest 0: a wrong code, a hint, the right code
  await say('/verify deadbeef')
  assert.match(gh.said(2), /doesn't match/)
  await say('/hint')
  assert.match(gh.said(2), /Hint 1 of 3/)
  await say(`/verify ${labCode('setup', PLAYER)}`)
  assert.equal(gh.issues.get(2).state, 'closed')
  assert.equal(gh.state.level, 1)
  assert.equal(gh.state.xp, 45)

  // Quest 1: a badly named branch, an unlinked email, then right
  const q1 = issueOf()
  await push('my-branch', { 'hello.md': '# Hello\n\n## Players\n- niraj\n' })
  assert.match(gh.said(q1), /git branch -m feat\/hello-nirajkaushik22/)
  const branch = 'feat/hello-nirajkaushik22'
  await push(branch, { 'hello.md': '# Hello\n\n## Players\n- niraj\n' }, { username: null })
  assert.match(gh.said(q1), /can't link its email/)
  await push(branch, { 'hello.md': '# Hello\n\n## Players\n- niraj: hi!\n' })
  assert.equal(gh.state.level, 2)

  // Quest 2: a weak PR, then fixed
  const pr1 = await openPr(branch, 'Update hello.md', '## What\n<!-- describe -->\n')
  assert.match(gh.said(pr1.number), /"Update <file>"/)
  assert.match(gh.said(pr1.number), /"why", "how i tested"|"what", "why", "how i tested"/)
  Object.assign(pr1, { title: 'Add Niraj to the players list', body: TEMPLATE_OK })
  await send('pull_request', { action: 'edited', pull_request: pr1 })
  assert.equal(gh.state.level, 3)
  assert.equal(gh.reviews.at(-1).event, 'REQUEST_CHANGES')

  // Quest 3: fix, reply, approval, merge
  await push(branch, { 'hello.md': '# Hello\n\n## Players\n- niraj: hi!\nFun fact: I like chess.\n' })
  assert.match(gh.said(pr1.number), /reply to my comment/)
  await send('pull_request_review_comment', { action: 'created', pull_request: { number: pr1.number }, comment: { in_reply_to_id: quest().data.commentId } })
  assert.equal(gh.reviews.at(-1).event, 'APPROVE')
  await merge(pr1)
  assert.equal(gh.state.level, 4)
  assert.equal(gh.state.xp, 45 + 100 + 150 + 150)

  // Quest 4: branch from stale main, fix it, force-push over the teammate, then sync properly
  const q4 = issueOf()
  const staleMain = gh.commits.get(gh.refs.get('main')).parents[0]
  const about = 'feat/about-nirajkaushik22'
  await push(about, { 'about/nirajkaushik22.md': 'Niraj\nFrontend\nGit\n' }, { from: staleMain })
  assert.match(gh.said(q4), /missing the teammate's commit/)
  await push(about, {}, { parents: [gh.refs.get(about), gh.refs.get('main')], message: 'Merge main' })
  assert.equal(quest().data.phase, 'sync')
  assert.match(gh.said(q4), /Plot twist/)
  const beforeBot = gh.commits.get(quest().data.botSha).parents[0]
  await push(about, { 'about/nirajkaushik22.md': 'Niraj\nFrontend\nGit\nLine 4\n' }, { from: beforeBot, forced: true })
  assert.match(gh.said(q4), /force-push/)
  await push(about, { 'about/nirajkaushik22.md': 'Niraj\nFrontend\nGit\nLine 4\n' }, { parents: [gh.refs.get(about), quest().data.botSha], message: 'Merge' })
  assert.equal(quest().data.phase, 'pr')
  await merge(await openPr(about, 'Add an about page for Niraj'))
  assert.equal(gh.state.level, 5)
  assert.equal(gh.state.quests[4].earned, 100)

  // Quest 5: the conflict
  const fav = 'feat/favorite-editor'
  await push(fav, { 'config/settings.md': 'theme: dark\nfavorite_editor: vscode\ntab_width: 2\n' }, { from: gh.refs.get('main') })
  const pr5 = await openPr(fav, 'Set my favourite editor', TEMPLATE_OK, { files: [{ filename: 'config/settings.md', patch: '-favorite_editor: TBD\n+favorite_editor: vscode' }] })
  assert.match(gh.said(pr5.number), /Uh oh/)
  assert.match(await gh.getFile('config/settings.md', 'main'), /vim/)
  await push(fav, { 'config/settings.md': 'theme: dark\nfavorite_editor: vscode!\ntab_width: 2\n' })
  assert.match(gh.said(pr5.number), /doesn't include the teammate's change/)
  await push(fav, { 'config/settings.md': '<<<<<<< HEAD\nfavorite_editor: vscode\n=======\n' }, { parents: [gh.refs.get(fav), gh.refs.get('main')] })
  assert.match(gh.said(pr5.number), /still contains conflict markers/)
  await push(fav, { 'config/settings.md': 'theme: dark\nfavorite_editor: vscode\ntab_width: 2\n' })
  assert.match(gh.said(pr5.number), /Conflict resolved/)
  await merge(pr5)
  assert.equal(gh.state.level, 6)

  // Quest 6: revert
  assert.match(await gh.getFile('hello.md', 'main'), /BROKEN BANNER/)
  assert.match(gh.issues.get(issueOf()).body, new RegExp(quest().data.badShort))
  const fix = 'fix/revert-banner'
  const hello = (await gh.getFile('hello.md', 'main')).replace(/\n\nBROKEN BANNER.*\n/, '\n')
  await push(fix, { 'hello.md': hello, 'banner.txt': null }, { from: gh.refs.get('main') })
  await merge(await openPr(fix, 'Revert the experimental banner', TEMPLATE_OK, { commits: [{ sha: 'x', commit: { message: 'Revert "Add an experimental banner"' } }] }))
  assert.equal(gh.state.level, 7)
  assert.equal(gh.state.quests[6].earned, 200)

  // Quest 7: leak the secret, then clean the branch
  const secret = quest().data.secret
  assert.match(gh.issues.get(issueOf()).body, new RegExp(secret))
  const cfg = 'chore/local-config'
  const leakSha = await push(cfg, { '.env': `API_KEY=${secret}\n` }, { from: gh.refs.get('main') })
  gh.patches.set(leakSha, [{ patch: `@@ -0,0 +1 @@\n+API_KEY=${secret}` }])
  const pr7 = await openPr(cfg, 'Add local config', TEMPLATE_OK, { commits: [{ sha: leakSha, commit: { message: 'Add local config' } }] })
  assert.match(gh.said(pr7.number), /Secret scan failed/)
  const cleanSha = await push(cfg, { '.gitignore': '.DS_Store\n.env\n' }, { from: gh.commits.get(leakSha).parents[0], forced: true })
  pr7.commits = [{ sha: cleanSha, commit: { message: 'Ignore local env files' } }]
  pr7.head.sha = cleanSha
  await send('pull_request', { action: 'synchronize', pull_request: pr7 })
  assert.match(gh.said(pr7.number), /Scan is clean now/)
  await merge(pr7)
  assert.equal(gh.state.level, 8)
  assert.ok(gh.state.achievements.some((a) => a.name === 'Leak plugged'))

  // Quest 8: four lab codes, one repeated
  for (const lab of ['restore', 'unstage', 'unstage', 'stash', 'detective']) await say(`/verify ${labCode(lab, PLAYER)}`)
  assert.equal(gh.state.level, 9)

  // Quest 9: red CI, green CI, merge
  const boss = 'feat/status-badge'
  await push(boss, { 'app/components/StatusBadge.tsx': 'x' }, { from: gh.refs.get('main') })
  const files = [{ filename: 'app/components/StatusBadge.tsx' }, { filename: 'app/components/StatusBadge.test.tsx' }, { filename: 'app/app/page.tsx' }]
  const pr9 = await openPr(boss, 'Add a StatusBadge component', TEMPLATE_OK, { files })
  const ci = (conclusion) => send('workflow_run', { action: 'completed', workflow_run: { name: 'App CI', conclusion, head_sha: pr9.head.sha, pull_requests: [{ number: pr9.number }] } })
  await ci('failure')
  assert.match(gh.said(pr9.number), /CI failed/)
  await ci('success')
  assert.equal(gh.reviews.at(-1).event, 'APPROVE')
  await merge(pr9)

  // Finished
  assert.equal(gh.state.level, 10)
  assert.ok(gh.state.finished_at)
  assert.equal(gh.state.xp, 45 + 100 + 150 + 150 + 100 + 250 + 200 + 200 + 200 + 500)
  assert.equal(gh.state.rank, 'Maintainer')
  assert.equal(gh.issues.get(1).state, 'closed')
  assert.match(gh.issues.get(1).body, /## Certificate/)
  assert.match(gh.said(1), /@mentor: ready for the real repo/)
  assert.ok(gh.state.achievements.some((a) => a.name === 'Clean merge') === false) // took 3 pushes
})

test('merging before approval in quest 3 costs XP but still moves on', async () => {
  const { gh, send, push, openPr, merge, say } = setup()
  await send('workflow_dispatch', { inputs: { action: 'start' } }, 'mentor')
  await say(`/verify ${labCode('setup', PLAYER)}`)
  await push('feat/hi', { 'hello.md': 'hi\n' })
  const pr = await openPr('feat/hi', 'Add me to the list')
  assert.ok(gh.state.achievements.some((a) => a.name === 'Perfect PR'))
  await merge(pr)
  assert.equal(gh.state.level, 4)
  assert.equal(gh.state.quests[3].earned, 125)
})

test('mentor can skip and reset', async () => {
  const { gh, send } = setup()
  await send('workflow_dispatch', { inputs: { action: 'start' } }, 'mentor')
  await send('workflow_dispatch', { inputs: { action: 'skip' } }, 'mentor')
  assert.equal(gh.state.level, 1)
  assert.equal(gh.state.quests[0].earned, 0)
  await send('workflow_dispatch', { inputs: { action: 'reset' } }, 'mentor')
  assert.equal(gh.state, null)
  assert.ok([...gh.issues.values()].every((i) => i.state === 'closed'))
})
