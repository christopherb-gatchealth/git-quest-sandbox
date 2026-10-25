import { HINT_COST, SPEEDRUN_MS, labCode, rankFor, render } from './util.mjs'
import { QUESTS } from './quests.mjs'

const MAX_XP = QUESTS.reduce((s, q) => s + q.xp, 0)
const hintCost = (q) => Math.round(q.xp * HINT_COST)

function newState(config, now) {
  return {
    version: 1,
    player: config.player,
    level: 0,
    xp: 0,
    rank: rankFor(0),
    level_label: `0 of ${QUESTS.length}`,
    started_at: now().toISOString(),
    finished_at: null,
    log_issue: null,
    quests: {},
    achievements: [],
    penalties: [],
  }
}

// Runs one GitHub event through the game. Everything the engine knows about
// the outside world comes through `gh`, so tests can pass in a fake.
export async function run({ gh, event, eventName, config, now = () => new Date(), readBody, log = console.log }) {
  const actor = (event.sender?.login || '').toLowerCase()
  const player = config.player.toLowerCase()
  const mentor = (config.mentor || '').toLowerCase()

  const loaded = await gh.readState()
  let state = loaded?.state ?? null
  let stateSha = loaded?.sha ?? null

  const vars = () => ({
    player: config.player, playerLower: player, mentor: config.mentor,
    owner: gh.owner, repo: gh.repo, logIssue: state?.log_issue,
    data: state?.quests[state.level]?.data ?? {},
  })

  async function save() {
    state.rank = rankFor(state.xp)
    state.level_label = `${Math.min(state.level, QUESTS.length)} of ${QUESTS.length}`
    stateSha = await gh.writeState(state, stateSha)
    if (state.log_issue) await gh.updateIssue(state.log_issue, { body: renderLog(state, config) })
  }

  async function startQuest(i) {
    const q = QUESTS[i]
    state.level = i
    state.quests[i] = { id: q.id, issue: null, opened_at: now().toISOString(), completed_at: null, hints: 0, penalty: 0, earned: null, data: {} }
    if (q.onStart) await q.onStart(makeCtx(i))
    const body = render(readBody(i, q.id), vars())
    const issue = await gh.createIssue(`Quest ${i}: ${q.title} (${q.xp} XP)`, body, ['quest'])
    state.quests[i].issue = issue.number
    await save()
  }

  async function finish() {
    state.finished_at = now().toISOString()
    if (Object.values(state.quests).every((qs) => qs.hints === 0)) award('Hintless', 'Finished every quest without a hint')
    await save()
    await gh.comment(state.log_issue, `## Quest complete!\n\n@${config.player} finished all ${QUESTS.length} quests with **${state.xp} of ${MAX_XP} XP**, rank **${rankFor(state.xp)}**.${mentor ? `\n\n@${config.mentor}: ready for the real repo.` : ''}`)
    await gh.updateIssue(state.log_issue, { state: 'closed', state_reason: 'completed' })
  }

  function award(name, why, quest) {
    if (state.achievements.some((a) => a.name === name)) return
    state.achievements.push({ name, why, quest: quest ?? null, at: now().toISOString() })
  }

  function makeCtx(i) {
    const q = QUESTS[i]
    const qs = state.quests[i]
    const ctx = {
      gh, event, eventName, now, player: config.player, state,
      data: qs.data,
      prev: (id) => Object.values(state.quests).find((x) => x.id === id)?.data ?? {},
      say: (body) => gh.comment(qs.issue, body),
      sayPr: (n, body) => gh.comment(n, body),
      save,
      penalize(points, reason) {
        qs.penalty += points
        state.penalties.push({ quest: i, points, reason })
      },
      achieve: (name, why) => award(name, why, i),
      // Runs fn once per key, so repeated events don't repeat the same comment.
      async once(key, fn) {
        qs.data._said ??= []
        if (qs.data._said.includes(key)) return
        qs.data._said.push(key)
        await fn()
      },
      async complete(summary) {
        if (qs.completed_at) return
        const spent = qs.hints * hintCost(q)
        qs.earned = Math.max(0, q.xp - spent - qs.penalty)
        qs.completed_at = now().toISOString()
        state.xp += qs.earned
        if (i > 0 && Date.parse(qs.completed_at) - Date.parse(qs.opened_at) < SPEEDRUN_MS) award('Speedrun', 'Finished a quest within 10 minutes', i)
        const costs = [
          spent ? `-${spent} for ${qs.hints} hint${qs.hints > 1 ? 's' : ''}` : null,
          ...state.penalties.filter((p) => p.quest === i).map((p) => `-${p.points}: ${p.reason}`),
        ].filter(Boolean)
        await gh.comment(qs.issue, `### Quest complete: +${qs.earned} XP\n\n${summary}${costs.length ? `\n\n${costs.map((c) => `- ${c}`).join('\n')}` : ''}\n\nTotal: **${state.xp} XP**, rank **${rankFor(state.xp)}**.${i + 1 < QUESTS.length ? ' Your next quest is open now.' : ''}`)
        await gh.updateIssue(qs.issue, { state: 'closed', state_reason: 'completed' })
        if (i + 1 < QUESTS.length) await startQuest(i + 1)
        else {
          state.level = QUESTS.length
          await finish()
        }
      },
    }
    return ctx
  }

  // ── Mentor actions (Actions tab → Quest Engine → Run workflow) ─────────────
  if (eventName === 'workflow_dispatch') {
    const action = event.inputs?.action || 'start'
    if (action === 'start') {
      if (state && !state.finished_at) return log('Already started; use reset first to begin again.')
      state = newState(config, now)
      stateSha = loaded?.sha ?? null
      await gh.ensureLabel('quest', '7057ff', 'A Git Quest level')
      await gh.ensureLabel('quest-log', 'fbca04', 'Git Quest progress')
      const logIssue = await gh.createIssue(`Quest Log: @${config.player}`, 'Setting up...', ['quest-log'])
      state.log_issue = logIssue.number
      await startQuest(0)
      return log(`Started. Quest Log is #${state.log_issue}.`)
    }
    if (action === 'reset') {
      for (const label of ['quest', 'quest-log']) {
        for (const issue of await gh.listOpenIssues(label)) await gh.updateIssue(issue.number, { state: 'closed', state_reason: 'not_planned' })
      }
      await gh.deleteState()
      return log('Reset. Run the workflow with "start" to begin again.')
    }
    if (action === 'skip') {
      if (!state || state.finished_at) return log('Nothing to skip.')
      const i = state.level
      const ctx = makeCtx(i)
      ctx.penalize(QUESTS[i].xp, 'Skipped by the mentor')
      await ctx.complete('Skipped by the mentor.')
      return log(`Skipped quest ${i}.`)
    }
    return log(`Unknown action "${action}".`)
  }

  if (!state || state.finished_at) return log('No game in progress.')
  if (actor !== player && actor !== mentor) return log(`Ignoring ${eventName} from ${actor || 'unknown'}.`)

  const i = state.level
  const q = QUESTS[i]
  const qs = state.quests[i]
  const before = JSON.stringify(state)

  if (eventName === 'issue_comment' && event.action === 'created') {
    await handleCommand(event.comment.body || '', event.issue.number)
  } else if (actor === player && q.onEvent) {
    await q.onEvent(makeCtx(i))
  }

  if (JSON.stringify(state) !== before) await save()

  async function handleCommand(text, issueNumber) {
    const [cmd, ...args] = text.trim().split(/\s+/)
    const reply = (body) => gh.comment(issueNumber, body)
    if (cmd === '/status') {
      return reply(`**Quest ${i}: ${q.title}** (#${qs.issue}). ${state.xp} XP, rank **${rankFor(state.xp)}**. Full progress in #${state.log_issue}.`)
    }
    if (actor !== player) return
    if (cmd === '/hint') {
      if (issueNumber !== qs.issue) return reply(`Hints are for your current quest. Ask on #${qs.issue}.`)
      if (qs.hints >= q.hints.length) return reply(`That's every hint for this quest.${config.mentor ? ` Still stuck? Ask @${config.mentor}.` : ''}`)
      const hint = render(q.hints[qs.hints], vars())
      qs.hints += 1
      return reply(`**Hint ${qs.hints} of ${q.hints.length}** (-${hintCost(q)} XP when you finish):\n\n${hint}`)
    }
    if (cmd === '/verify') {
      if (!q.codes) return reply('This quest is checked automatically; there\'s no code to verify.')
      const code = (args[0] || '').toLowerCase()
      qs.data.verified ??= []
      const lab = q.codes.find((l) => labCode(l, config.player) === code)
      if (!lab) return reply(`That code doesn't match. Run the command again and copy the 8 characters it prints after \`/verify\`.`)
      if (qs.data.verified.includes(lab)) return reply(`\`${lab}\` is already verified.`)
      qs.data.verified.push(lab)
      const left = q.codes.filter((l) => !qs.data.verified.includes(l))
      if (left.length) return reply(`Verified **${lab}**. Still to do: ${left.map((l) => `\`${l}\``).join(', ')}.`)
      return makeCtx(i).complete(q.codes.length === 1 ? 'Setup verified: git, your identity and SSH all work.' : `All ${q.codes.length} labs verified.`)
    }
  }
}

export function renderLog(state, config) {
  const pct = Math.round((state.xp / MAX_XP) * 100)
  const filled = Math.round(pct / 5)
  const bar = `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`
  const rows = QUESTS.map((q, i) => {
    const qs = state.quests[i]
    const status = !qs ? 'Locked' : qs.completed_at ? 'Done' : `In progress: #${qs.issue}`
    const xp = qs?.completed_at ? `${qs.earned} / ${q.xp}` : `- / ${q.xp}`
    return `| ${i} | ${q.title} | ${status} | ${xp} |`
  })
  const ach = state.achievements.length
    ? state.achievements.map((a) => `- **${a.name}**: ${a.why}${a.quest != null ? ` (quest ${a.quest})` : ''}`).join('\n')
    : '_None yet. Some are hidden._'
  const done = state.finished_at
    ? `\n\n## Certificate\n\n> **@${config.player}** completed Git Quest with **${state.xp} XP** and the rank of **${rankFor(state.xp)}**, ${state.finished_at.slice(0, 10)}.`
    : ''
  return `# Quest Log: @${config.player}

**Rank:** ${rankFor(state.xp)} · **XP:** ${state.xp} of ${MAX_XP} · **Quests done:** ${Object.values(state.quests).filter((x) => x.completed_at).length} of ${QUESTS.length}

\`${bar}\` ${pct}%

| # | Quest | Status | XP |
| --- | --- | --- | --- |
${rows.join('\n')}

## Achievements

${ach}

## Ranks

Intern (0) → Committer (400) → Reviewer (1000) → Maintainer (1600)

## Commands

Comment these on your current quest's issue:

- \`/hint\`: get the next hint (each costs 10% of that quest's XP)
- \`/verify <code>\`: hand in a code from \`./quest\`
- \`/status\`: where you are${done}
`
}
