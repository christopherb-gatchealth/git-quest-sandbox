import { BRANCH_RE, branchOf, isPlayerBranch, prProblems, patchAddsSecret, fakeSecret } from './util.mjs'

// Each quest: id, title, xp, hints, and optional hooks.
//   codes:   lab codes the player must /verify to finish (checked by the engine)
//   onStart: runs before the quest's issue opens; may set ctx.data for its body
//   onEvent: runs for every GitHub event while the quest is current
// The issue body for quest N is quests/NN-<id>.md.

// ── Event helpers ────────────────────────────────────────────────────────────

// The player's push to one of their own branches, or null.
function pushOf(ctx) {
  if (ctx.eventName !== 'push' || ctx.event.deleted) return null
  const branch = branchOf(ctx.event.ref)
  if (!isPlayerBranch(branch)) return null
  return { branch, sha: ctx.event.after, forced: !!ctx.event.forced, commits: ctx.event.commits || [] }
}

// The player's PR into main, when the event's action is one of `actions`.
function prOf(ctx, actions) {
  if (ctx.eventName !== 'pull_request' || !actions.includes(ctx.event.action)) return null
  const pr = ctx.event.pull_request
  if (pr.base.ref !== 'main' || pr.user.login.toLowerCase() !== ctx.player.toLowerCase()) return null
  return pr
}

const merged = (ctx) => {
  const pr = prOf(ctx, ['closed'])
  return pr && pr.merged ? pr : null
}

// The branch and head commit an event points at: a push, or a PR update.
function headOf(ctx) {
  const p = pushOf(ctx)
  if (p) return { branch: p.branch, sha: p.sha, forced: p.forced }
  const pr = prOf(ctx, ['opened', 'reopened', 'synchronize'])
  if (pr) return { branch: pr.head.ref, sha: pr.head.sha, forced: false }
  return null
}

const contains = async (ctx, ancestor, head) => {
  const c = await ctx.gh.compare(ancestor, head)
  return c.status === 'ahead' || c.status === 'identical'
}

async function scanPull(gh, n) {
  for (const c of await gh.listPullCommits(n)) {
    const full = await gh.getCommit(c.sha)
    if ((full.files || []).some((f) => patchAddsSecret(f.patch))) return true
  }
  return false
}

async function problemsOnPr(ctx, pr) {
  const problems = prProblems(pr)
  const key = problems.join('|')
  if (problems.length && ctx.data.lastProblems !== key) {
    ctx.data.lastProblems = key
    await ctx.sayPr(pr.number, `Almost there. Before this PR is ready:\n\n${problems.map((p) => `- ${p}`).join('\n')}\n\nEdit the PR (the **Edit** button next to the title, or **...** → **Edit** on the description) and I'll check again.`)
  }
  return problems
}

// ── Quests ───────────────────────────────────────────────────────────────────

export const QUESTS = [
  {
    id: 'setup',
    title: 'Set up your tools',
    xp: 50,
    codes: ['setup'],
    hints: [
      'If `git --version` opens a pop-up, click **Install** and wait for the developer tools to finish, then open a new Terminal window.',
      '"Permission denied (publickey)" means GitHub doesn\'t have your key. Run `cat ~/.ssh/id_ed25519.pub`, and check that exact line is under **Settings → SSH and GPG keys** on GitHub.',
      '`./quest check` must be run from inside the cloned folder: `cd ~/code/{{repo}}` first. If it says "permission denied", run `chmod +x quest`.',
    ],
  },

  {
    id: 'first-commit',
    title: 'Your first commit',
    xp: 100,
    hints: [
      'Run `git status` after each step. It tells you which branch you\'re on and what is staged.',
      'If `git push` says "no upstream branch", you forgot `-u origin <branch>` the first time. Copy the command git suggests.',
      'Commit made with the wrong email? Fix it with `git config --global user.email "..."`, make one more small change to `hello.md`, commit and push again.',
    ],
    async onEvent(ctx) {
      const p = pushOf(ctx)
      if (!p) return
      const touched = p.commits.filter((c) => [...(c.added || []), ...(c.modified || [])].includes('hello.md'))
      if (!touched.length) {
        return ctx.once(`nohello:${p.sha}`, () => ctx.say(`I saw your push to \`${p.branch}\`, but none of its commits change \`hello.md\`. Add your line to \`hello.md\`, then \`git add\`, \`git commit\` and \`git push\` again.`))
      }
      if (!BRANCH_RE.test(p.branch)) {
        return ctx.once(`badname:${p.branch}`, () => ctx.say(`Nice push! But the branch is called \`${p.branch}\`, and branch names here start with \`feat/\`, \`fix/\` or \`chore/\` and use lowercase, for example \`feat/hello-${ctx.player.toLowerCase()}\`.\n\nRename it and push again:\n\n\`\`\`bash\ngit branch -m feat/hello-${ctx.player.toLowerCase()}\ngit push -u origin feat/hello-${ctx.player.toLowerCase()}\n\`\`\``))
      }
      const linked = touched.some((c) => (c.author?.username || '').toLowerCase() === ctx.player.toLowerCase())
      if (!linked) {
        const email = touched[0].author?.email
        return ctx.once(`email:${p.sha}`, () => ctx.say(`Your commit arrived, but GitHub can't link its email (\`${email}\`) to your account, so it won't count as yours.\n\nSet an email that's verified on GitHub (**Settings → Emails**; the \`…@users.noreply.github.com\` one works), then make one more small change to \`hello.md\`, commit and push:\n\n\`\`\`bash\ngit config --global user.email "you@example.com"\n\`\`\``))
      }
      ctx.data.branch = p.branch
      await ctx.complete(`Pushed \`${p.branch}\` with a commit to \`hello.md\`.`)
    },
  },

  {
    id: 'pull-request',
    title: 'Open a pull request',
    xp: 150,
    hints: [
      'After you push a branch, GitHub shows a yellow **Compare & pull request** banner on the repo\'s front page. You can also go to **Pull requests → New pull request** and pick your branch.',
      'The description already contains the headings. Write your text under each one; the grey `<!-- -->` notes are invisible and don\'t count.',
    ],
    async onEvent(ctx) {
      const pr = prOf(ctx, ['opened', 'edited', 'reopened', 'synchronize'])
      if (!pr) return
      ctx.data.attempts = (ctx.data.attempts || 0) + 1
      if ((await problemsOnPr(ctx, pr)).length) return
      if (ctx.data.attempts === 1) ctx.achieve('Perfect PR', 'PR title and description right first time')
      ctx.data.pr = pr.number
      await ctx.complete(`PR #${pr.number} has a clear title and a full description.`)
    },
  },

  {
    id: 'review',
    title: 'Survive code review',
    xp: 150,
    hints: [
      'Changes for a PR go on the same branch. Edit `hello.md`, commit, and `git push`: the PR updates itself.',
      'To reply to my comment, open the PR\'s **Files changed** tab, find my comment on `hello.md`, and use the **Reply...** box under it, not the main conversation box.',
    ],
    async onStart(ctx) {
      const n = ctx.prev('pull-request').pr
      const pr = await ctx.gh.getPull(n)
      ctx.data.pr = n
      const c = await ctx.gh.fileComment(n, {
        path: 'hello.md',
        commitId: pr.head.sha,
        body: 'Could you add a line starting with `Fun fact:` under your entry? Something you like, a place you\'ve been, anything. Reply here once it\'s pushed.',
      })
      ctx.data.commentId = c.id
      await ctx.gh.review(n, 'REQUEST_CHANGES', 'Thanks for the PR! One change before I approve: see my comment on `hello.md`.')
    },
    async onEvent(ctx) {
      const n = ctx.data.pr
      const e = ctx.event
      if (ctx.eventName === 'pull_request_review_comment' && e.action === 'created' && e.pull_request.number === n && e.comment.in_reply_to_id === ctx.data.commentId) {
        ctx.data.replied = true
      }
      const update = prOf(ctx, ['synchronize'])
      if (update && update.number === n) {
        const text = await ctx.gh.getFile('hello.md', update.head.sha)
        if (/^\s*[-*]?\s*fun fact:/im.test(text || '')) ctx.data.fixed = true
        else await ctx.once(`nofix:${update.head.sha}`, () => ctx.sayPr(n, 'I see a new push, but `hello.md` still has no line starting with `Fun fact:`.'))
      }

      const done = merged(ctx)
      if (done && done.number === n) {
        if (!ctx.data.fixed) {
          const text = await ctx.gh.getFile('hello.md', 'main')
          if (/^\s*[-*]?\s*fun fact:/im.test(text || '')) ctx.data.fixed = true
        }
        if (!ctx.data.approved) ctx.penalize(25, 'Merged before the reviewer approved')
        return ctx.complete(ctx.data.approved ? `PR #${n} reviewed, approved and merged.` : `PR #${n} merged, though without an approval. At work, wait for the green tick.`)
      }
      const closed = prOf(ctx, ['closed'])
      if (closed && closed.number === n) return ctx.sayPr(n, 'This PR was closed without merging. Click **Reopen pull request** to carry on with the quest.')

      if (ctx.data.fixed && ctx.data.replied && !ctx.data.approved) {
        ctx.data.approved = true
        await ctx.save()
        try {
          await ctx.gh.review(n, 'APPROVE', 'Looks great, approved! Merge it with **Squash and merge**, then click **Delete branch**.')
        } catch {
          await ctx.sayPr(n, 'Looks great, approved! Merge it with **Squash and merge**, then click **Delete branch**.')
        }
      } else if (ctx.data.fixed && !ctx.data.replied) {
        await ctx.once('needreply', () => ctx.sayPr(n, 'The fix is in. Last step: reply to my comment on `hello.md` in the **Files changed** tab, so the reviewer knows it\'s handled.'))
      } else if (ctx.data.replied && !ctx.data.fixed) {
        await ctx.once('needfix', () => ctx.sayPr(n, 'Thanks for the reply! Now push the `Fun fact:` line to this branch and I\'ll approve.'))
      }
    },
  },

  {
    id: 'sync',
    title: 'Stay in sync',
    xp: 150,
    hints: [
      'Before starting any new branch: `git switch main` then `git pull`. That brings in everything teammates merged.',
      'When `git push` is rejected with "fetch first" or "non-fast-forward", someone else pushed to your branch. Run `git pull --no-edit`, then `git push`. Never use `--force` to get around it.',
      'Forgot to pull before branching? Run `git switch main && git pull && git switch -` then `git merge --no-edit main` and push. (`git switch -` goes back to the branch you were on.)',
    ],
    async onStart(ctx) {
      const today = ctx.now().toISOString().slice(0, 10)
      const { sha } = await ctx.gh.botMerge({
        branch: 'bot/team-update',
        title: 'Note when the team page was last updated',
        body: 'A teammate\'s change, merged while you were working. Pull it before you branch.',
        edit: async (read) => ({ 'about/README.md': `${(await read('about/README.md')).trimEnd()}\n\nLast updated by the team on ${today}.\n` }),
      })
      ctx.data.teamSha = sha
      ctx.data.phase = 'branch'
    },
    async onEvent(ctx) {
      const login = ctx.player
      const head = headOf(ctx)
      if (ctx.data.phase === 'branch' && head && isPlayerBranch(head.branch)) {
        const file = await ctx.gh.getFile(`about/${login}.md`, head.sha)
        if (file === null) return
        if (!(await contains(ctx, ctx.data.teamSha, head.sha))) {
          return ctx.once(`stale:${head.sha}`, () => ctx.say(`Your branch \`${head.branch}\` is missing the teammate's commit that landed on main, so it was started from an old \`main\`. Bring it in, then push:\n\n\`\`\`bash\ngit switch main\ngit pull\ngit switch ${head.branch}\ngit merge --no-edit main\ngit push\n\`\`\``))
        }
        ctx.data.branch = head.branch
        ctx.data.phase = 'sync'
        ctx.data.botSha = await ctx.gh.botPush(head.branch, async (read) => ({ 'about/README.md': `${(await read('about/README.md')).trimEnd()}\n\n- [${login}](${login}.md)\n` }), `Add ${login} to the team list`)
        await ctx.save()
        return ctx.say(`Good start: \`${head.branch}\` is based on the latest \`main\`.\n\n**Plot twist:** a teammate just pushed a commit to your branch, adding you to the team list in \`about/README.md\`. Your laptop doesn't have it yet.\n\nNow add a 4th line to \`about/${login}.md\`, commit, and \`git push\`. The push will be **rejected**. That's the lesson: run \`git pull --no-edit\`, then \`git push\` again.`)
      }

      if (ctx.data.phase === 'sync' && head && head.branch === ctx.data.branch && head.sha !== ctx.data.botSha) {
        if (await contains(ctx, ctx.data.botSha, head.sha)) {
          ctx.data.phase = 'pr'
          return ctx.say('Synced! Your branch has your teammate\'s commit and yours. Now open a PR for it (fill in the template), then **Squash and merge** it.')
        }
        if (head.forced) {
          ctx.penalize(50, 'Force-pushed over a teammate\'s commit')
          ctx.data.botSha = await ctx.gh.botPush(head.branch, async (read) => ({ 'about/README.md': `${(await read('about/README.md')).trimEnd()}\n\n- [${login}](${login}.md)\n` }), `Add ${login} to the team list again`)
          await ctx.save()
          return ctx.say('Ouch: that was a force-push, and it deleted your teammate\'s commit from the branch (-50 XP). On a shared branch, never use `--force`; use `git pull` instead.\n\nI\'ve pushed their change again. Run `git pull --no-edit`, then `git push`.')
        }
      }

      const done = merged(ctx)
      if (done && done.head.ref === ctx.data.branch) {
        if (ctx.data.phase !== 'pr') ctx.penalize(25, 'Merged before finishing the sync steps')
        return ctx.complete(`Branched from fresh \`main\`, pulled a teammate's push, and merged PR #${done.number}.`)
      }
    },
  },

  {
    id: 'conflict',
    title: 'Resolve a merge conflict',
    xp: 250,
    hints: [
      'In the conflicted file, keep the lines you want and delete the three marker lines: `<<<<<<<`, `=======` and `>>>>>>>`. VS Code shows **Accept Current / Incoming / Both** buttons above the conflict to help.',
      'After fixing the file: `git add config/settings.md`, then `git commit --no-edit` finishes the merge. Then `git push`.',
      'Panicking mid-merge? `git merge --abort` puts everything back the way it was before `git merge main`.',
    ],
    async onEvent(ctx) {
      const pr = prOf(ctx, ['opened', 'reopened', 'synchronize'])
      if (pr && !ctx.data.phase) {
        const files = await ctx.gh.listPullFiles(pr.number)
        const f = files.find((x) => x.filename === 'config/settings.md')
        if (!f || !/^\+favorite_editor:/m.test(f.patch || '')) {
          return ctx.once(`noline:${pr.number}`, () => ctx.sayPr(pr.number, 'For this quest, the PR needs to change the `favorite_editor:` line in `config/settings.md`.'))
        }
        await problemsOnPr(ctx, pr)
        const { sha } = await ctx.gh.botMerge({
          branch: 'bot/team-editor',
          title: 'Pick the team\'s default editor',
          body: 'A teammate changed the same line you did, and merged first.',
          edit: async (read) => ({ 'config/settings.md': (await read('config/settings.md')).replace(/^favorite_editor:.*$/m, 'favorite_editor: vim (picked by the team)') }),
        })
        Object.assign(ctx.data, { pr: pr.number, teamSha: sha, phase: 'conflict', pushes: 0 })
        await ctx.save()
        return ctx.sayPr(pr.number, `**Uh oh.** A teammate just merged a change to the very same line in \`config/settings.md\`. Scroll down: this PR now says *"This branch has conflicts that must be resolved"*.\n\nResolve it on your laptop:\n\n\`\`\`bash\ngit switch main\ngit pull\ngit switch ${pr.head.ref}\ngit merge main          # git reports CONFLICT\n\`\`\`\n\nOpen \`config/settings.md\`, decide what the line should say, delete the conflict markers, then:\n\n\`\`\`bash\ngit add config/settings.md\ngit commit --no-edit\ngit push\n\`\`\``)
      }

      if (pr && ctx.data.phase === 'conflict' && pr.number === ctx.data.pr && ctx.event.action === 'synchronize') {
        ctx.data.pushes += 1
        const sha = pr.head.sha
        if (!(await contains(ctx, ctx.data.teamSha, sha))) {
          return ctx.once(`nomerge:${sha}`, () => ctx.sayPr(pr.number, 'This push doesn\'t include the teammate\'s change from `main` yet. Run `git merge main` on your branch, resolve, commit, and push.'))
        }
        const text = (await ctx.gh.getFile('config/settings.md', sha)) || ''
        if (/^(<{7}|={7}|>{7})/m.test(text)) {
          return ctx.once(`markers:${sha}`, () => ctx.sayPr(pr.number, 'Careful: `config/settings.md` still contains conflict markers (`<<<<<<<`, `=======` or `>>>>>>>`). Delete them, commit, and push.'))
        }
        if ((await ctx.gh.getMergeable(pr.number)) === false) {
          return ctx.once(`dirty:${sha}`, () => ctx.sayPr(pr.number, 'GitHub still reports a conflict on this PR. Merge `main` into your branch again and push.'))
        }
        ctx.data.phase = 'resolved'
        if (ctx.data.pushes === 1) ctx.achieve('Clean merge', 'Resolved a conflict in one push')
        return ctx.sayPr(pr.number, 'Conflict resolved! Now **Squash and merge** this PR.')
      }

      const done = merged(ctx)
      if (done && done.number === ctx.data.pr) {
        return ctx.complete(`Resolved the conflict on PR #${done.number} and merged it.`)
      }
    },
  },

  {
    id: 'revert',
    title: 'Undo a bad commit',
    xp: 200,
    hints: [
      '`git log --oneline -5` lists the last 5 commits on your current branch, newest first. The short code at the start of each line is its commit id.',
      '`git revert --no-edit <id>` makes a new commit that undoes that one. Do it on a branch, then push and open a PR as usual.',
    ],
    async onStart(ctx) {
      const { sha } = await ctx.gh.botMerge({
        branch: 'bot/experimental-banner',
        title: 'Add an experimental banner',
        body: 'Merged in a hurry. It shouldn\'t have been.',
        edit: async (read) => ({
          'hello.md': `${(await read('hello.md')).trimEnd()}\n\nBROKEN BANNER: this line breaks the site. Revert me!\n`,
          'banner.txt': 'Experimental banner. Not ready yet.\n',
        }),
      })
      ctx.data.badSha = sha
      ctx.data.badShort = sha.slice(0, 7)
    },
    async onEvent(ctx) {
      const opened = prOf(ctx, ['opened', 'reopened'])
      if (opened) {
        const commits = await ctx.gh.listPullCommits(opened.number)
        if (!commits.some((c) => /^Revert "/.test(c.commit.message))) {
          await ctx.once(`norevert:${opened.number}`, () => ctx.sayPr(opened.number, `I don't see a revert commit in this PR. The quest is to undo \`${ctx.data.badShort}\` with \`git revert\`, which writes the "undo" commit for you.`))
        }
      }
      const done = merged(ctx)
      if (!done) return
      const hello = (await ctx.gh.getFile('hello.md', 'main')) || ''
      const banner = await ctx.gh.getFile('banner.txt', 'main')
      if (hello.includes('BROKEN BANNER') || banner !== null) {
        return ctx.say(`PR #${done.number} is merged, but \`main\` still has the bad change (${banner !== null ? '`banner.txt` is still there' : 'the BROKEN BANNER line is still in `hello.md`'}). Make another branch and finish the undo.`)
      }
      const commits = await ctx.gh.listPullCommits(done.number)
      if (!commits.some((c) => /^Revert "/.test(c.commit.message))) ctx.penalize(50, 'Undid the change by hand instead of with git revert')
      await ctx.complete(`Undid \`${ctx.data.badShort}\` on \`main\` through PR #${done.number}.`)
    },
  },

  {
    id: 'secret',
    title: 'Secret leak drill',
    xp: 200,
    hints: [
      '`git reset --soft HEAD~1` removes your last commit but keeps its changes staged, so nothing you typed is lost.',
      '`git push --force-with-lease` replaces your branch on GitHub with your local one. It\'s OK here because nobody else uses this branch, and it refuses if someone did push to it.',
      'Make sure `.gitignore` has a line that is exactly `.env`. Check with `cat .gitignore`.',
    ],
    async onStart(ctx) {
      ctx.data.secret = fakeSecret()
    },
    async onEvent(ctx) {
      const pr = prOf(ctx, ['opened', 'reopened', 'synchronize'])
      if (pr) {
        const sha = pr.head.sha
        if (await scanPull(ctx.gh, pr.number)) {
          ctx.data.leaked = true
          return ctx.once(`leak:${sha}`, () => ctx.sayPr(pr.number, `**Secret scan failed** (see the red ✗ below). The key is in this PR's history, and on a public repo anyone could copy it.\n\nIn real life, the first step is always to **cancel (rotate) the key**, because it's already exposed. Then remove it from your branch:\n\n\`\`\`bash\ngit reset --soft HEAD~1          # undo the commit, keep the changes\ngit restore --staged .env        # take .env out of the next commit\necho ".env" >> .gitignore        # tell git to ignore it from now on\ngit add .gitignore\ngit commit -m "Ignore local env files"\ngit push --force-with-lease      # OK on your own branch only\n\`\`\``))
        }
        if (ctx.data.leaked) return ctx.once(`clean:${sha}`, () => ctx.sayPr(pr.number, 'Scan is clean now. Make sure `.gitignore` contains `.env`, then **Squash and merge**.'))
        return ctx.once(`nodrill:${sha}`, () => ctx.sayPr(pr.number, 'The scan passed, but this drill starts with the mistake: commit the `.env` file from the quest first, so you can see what the scan does.'))
      }

      const done = merged(ctx)
      if (!done) return
      const env = await ctx.gh.getFile('.env', 'main')
      const gitignore = (await ctx.gh.getFile('.gitignore', 'main')) || ''
      if (env !== null) return ctx.say('`.env` made it onto `main`. Remove it in a new PR (`git rm --cached .env`, then add `.env` to `.gitignore`).')
      if (!/^\/?\.env\s*$/m.test(gitignore)) return ctx.say('Nearly: `.gitignore` on `main` doesn\'t list `.env` yet. Add it in a new PR so this can\'t happen again.')
      if (await scanPull(ctx.gh, done.number)) ctx.penalize(100, 'Merged a PR that still had the secret in its commits')
      if (ctx.data.leaked) ctx.achieve('Leak plugged', 'Caught and removed a committed secret')
      await ctx.complete('`.env` is ignored and the secret never reached `main`.')
    },
  },

  {
    id: 'labs',
    title: 'Local labs: restore, unstage, stash, detective',
    xp: 200,
    codes: ['restore', 'unstage', 'stash', 'detective'],
    hints: [
      '`git status` prints the command to undo most things. Read the lines in brackets, like "(use git restore <file>...)".',
      'Stash lab: `git stash` parks your changes, `git stash pop` brings them back. Switch branches in between.',
      'Detective lab: `git log -S "debug_flag"` lists only the commits that added or removed that text.',
    ],
  },

  {
    id: 'boss',
    title: 'Boss level: ship a component',
    xp: 500,
    hints: [
      'Copy the shape of `app/components/ScoreBar.tsx`: an `interface` for the props, a default-exported function, Tailwind classes.',
      'The percentage: `(score * 100).toFixed(1) + \'%\'` turns 0.183 into "18.3%".',
      'CI failed? On the PR, click **Details** next to the red ✗ and scroll to the first error. Then run `npm test` and `npm run build` in `app/` on your laptop until both pass.',
    ],
    async onEvent(ctx) {
      const pr = prOf(ctx, ['opened', 'edited', 'reopened', 'synchronize'])
      if (pr) {
        const files = await ctx.gh.listPullFiles(pr.number)
        if (!files.some((f) => f.filename.startsWith('app/'))) return
        ctx.data.pr = pr.number
        await problemsOnPr(ctx, pr)
        return
      }

      if (ctx.eventName === 'workflow_run' && ctx.event.action === 'completed' && ctx.event.workflow_run.name === 'App CI') {
        const run = ctx.event.workflow_run
        const n = run.pull_requests?.[0]?.number
        if (!n || n !== ctx.data.pr) return
        ctx.data.runs = (ctx.data.runs || 0) + 1
        if (run.conclusion === 'success') {
          ctx.data.greenSha = run.head_sha
          if (ctx.data.runs === 1) ctx.achieve('Green on first try', 'Boss PR passed CI on its first run')
          return ctx.once(`green:${run.head_sha}`, async () => {
            const msg = 'CI is green: tests and build pass. Approved! **Squash and merge** to beat the boss.'
            try { await ctx.gh.review(n, 'APPROVE', msg) } catch { await ctx.sayPr(n, msg) }
          })
        }
        return ctx.once(`red:${run.head_sha}`, () => ctx.sayPr(n, `CI ${run.conclusion === 'failure' ? 'failed' : `finished with "${run.conclusion}"`}. Click **Details** next to the red ✗ to see the first error, fix it on your laptop (\`npm test\`, \`npm run build\`), then push.`))
      }

      const done = merged(ctx)
      if (!done) return
      const files = await ctx.gh.listPullFiles(done.number)
      if (!files.some((f) => f.filename.startsWith('app/'))) return
      const names = files.map((f) => f.filename)
      if (!names.includes('app/components/StatusBadge.tsx')) {
        return ctx.say(`PR #${done.number} merged, but it doesn't add \`app/components/StatusBadge.tsx\`. The boss is still standing!`)
      }
      if (!names.includes('app/components/StatusBadge.test.tsx')) ctx.penalize(100, 'Shipped the component without its own test file')
      const green = ctx.data.greenSha === done.head.sha ||
        (await ctx.gh.workflowRuns('app-ci.yml', done.head.sha)).some((r) => r.conclusion === 'success')
      if (!green) ctx.penalize(150, 'Merged without a green CI run')
      if (prProblems(done).length) ctx.penalize(50, 'PR description incomplete')
      await ctx.complete(`Shipped \`StatusBadge\` in PR #${done.number}.`)
    },
  },
]
