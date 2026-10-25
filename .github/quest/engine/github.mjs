import { sleep } from './util.mjs'

const STATE_BRANCH = 'quest-state'
const STATE_FILE = 'state.json'
const BOT = { name: 'Git Quest Bot', email: '41898282+github-actions[bot]@users.noreply.github.com' }

// A thin client over the GitHub REST API, holding only the calls the engine needs.
// Tests swap it for an in-memory fake with the same methods.
export function makeClient({ token, owner, repo, apiUrl = 'https://api.github.com', fetchImpl = fetch, wait = sleep }) {
  const R = `/repos/${owner}/${repo}`

  // allowMissing: return null when the thing isn't there. GitHub answers 404,
  // or 422 when deleting a branch that doesn't exist.
  async function request(method, path, body, { allow404 = false, allowMissing = false, retries = 3, retryOn = [] } = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`${apiUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if ((res.status === 404 && (allow404 || allowMissing)) || (res.status === 422 && allowMissing)) return null
      if (res.ok) return res.status === 204 ? null : res.json()
      const text = await res.text()
      if ((res.status >= 500 || retryOn.includes(res.status)) && attempt < retries) {
        await wait(2000 * (attempt + 1))
        continue
      }
      const err = new Error(`${method} ${path} -> ${res.status}: ${text}`)
      err.status = res.status
      throw err
    }
  }

  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

  async function getRefSha(branch) {
    const ref = await request('GET', `${R}/git/ref/heads/${branch}`, null, { allow404: true })
    return ref ? ref.object.sha : null
  }

  async function getFile(path, ref) {
    const r = await request('GET', `${R}/contents/${path}?ref=${encodeURIComponent(ref)}`, null, { allow404: true })
    if (!r || Array.isArray(r)) return null
    return Buffer.from(r.content, 'base64').toString('utf8')
  }

  // Makes one commit on top of `parentSha`. `edit` gets a reader for files at
  // the parent and returns { path: newContent | null }, where null deletes the file.
  async function commitOnTop(parentSha, edit, message) {
    const parent = await request('GET', `${R}/git/commits/${parentSha}`)
    const changes = await edit((path) => getFile(path, parentSha))
    const tree = await request('POST', `${R}/git/trees`, {
      base_tree: parent.tree.sha,
      tree: Object.entries(changes).map(([path, content]) =>
        content === null
          ? { path, mode: '100644', type: 'blob', sha: null }
          : { path, mode: '100644', type: 'blob', content },
      ),
    })
    const commit = await request('POST', `${R}/git/commits`, {
      message, tree: tree.sha, parents: [parentSha], author: BOT, committer: BOT,
    })
    return commit.sha
  }

  // GitHub creates workflow runs for the bot's PRs but never starts them, and
  // marks them failed once the PR closes. Delete them so the Actions tab only
  // shows real runs. Best effort: a leftover failed run is only cosmetic.
  async function removeRuns(headSha) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await wait(3000)
      const { workflow_runs: runs } = await request('GET', `${R}/actions/runs?head_sha=${headSha}&per_page=20`)
      if (!runs.length) return
      for (const r of runs) {
        if (r.status !== 'completed') await request('POST', `${R}/actions/runs/${r.id}/cancel`, null, { allowMissing: true, retries: 0 }).catch(() => {})
        else await request('DELETE', `${R}/actions/runs/${r.id}`, null, { allowMissing: true, retries: 0 }).catch(() => {})
      }
    }
  }

  return {
    owner, repo, request,

    // Game state lives in state.json on its own orphan branch, so saving it
    // never adds commits to main or the player's branches.
    async readState() {
      const r = await request('GET', `${R}/contents/${STATE_FILE}?ref=${STATE_BRANCH}`, null, { allow404: true })
      if (!r) return null
      return { state: JSON.parse(Buffer.from(r.content, 'base64').toString('utf8')), sha: r.sha }
    },
    async writeState(state, sha) {
      const content = JSON.stringify(state, null, 2) + '\n'
      if (!sha) {
        const tree = await request('POST', `${R}/git/trees`, { tree: [{ path: STATE_FILE, mode: '100644', type: 'blob', content }] })
        const commit = await request('POST', `${R}/git/commits`, { message: 'Start the quest log', tree: tree.sha, parents: [], author: BOT, committer: BOT })
        await request('POST', `${R}/git/refs`, { ref: `refs/heads/${STATE_BRANCH}`, sha: commit.sha })
        const r = await request('GET', `${R}/contents/${STATE_FILE}?ref=${STATE_BRANCH}`)
        return r.sha
      }
      const r = await request('PUT', `${R}/contents/${STATE_FILE}`, {
        message: `Level ${state.level}, ${state.xp} XP`, content: b64(content), sha, branch: STATE_BRANCH, author: BOT, committer: BOT,
      })
      return r.content.sha
    },
    async deleteState() {
      await request('DELETE', `${R}/git/refs/heads/${STATE_BRANCH}`, null, { allowMissing: true })
    },

    async ensureLabel(name, color, description) {
      try {
        await request('POST', `${R}/labels`, { name, color, description })
      } catch (e) {
        if (e.status !== 422) throw e // 422 = it already exists
      }
    },
    createIssue: (title, body, labels = []) => request('POST', `${R}/issues`, { title, body, labels }),
    updateIssue: (n, fields) => request('PATCH', `${R}/issues/${n}`, fields),
    comment: (n, body) => request('POST', `${R}/issues/${n}/comments`, { body }),
    listOpenIssues: (label) => request('GET', `${R}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`),

    getPull: (n) => request('GET', `${R}/pulls/${n}`),
    // GitHub works out whether a PR can merge in the background, so `mergeable`
    // is null for a few seconds after a push. Poll until it has an answer.
    async getMergeable(n) {
      for (let i = 0; i < 8; i++) {
        const pr = await request('GET', `${R}/pulls/${n}`)
        if (pr.mergeable !== null) return pr.mergeable
        await wait(3000)
      }
      return null
    },
    listPullFiles: (n) => request('GET', `${R}/pulls/${n}/files?per_page=100`),
    listPullCommits: (n) => request('GET', `${R}/pulls/${n}/commits?per_page=100`),
    getCommit: (sha) => request('GET', `${R}/commits/${sha}`),
    review: (n, event, body) => request('POST', `${R}/pulls/${n}/reviews`, { event, body }),
    fileComment: (n, { path, body, commitId }) =>
      request('POST', `${R}/pulls/${n}/comments`, { body, path, commit_id: commitId, subject_type: 'file' }),

    getFile,
    getRefSha,
    compare: (base, head) => request('GET', `${R}/compare/${base}...${head}`),
    async workflowRuns(workflowFile, headSha) {
      const r = await request('GET', `${R}/actions/workflows/${workflowFile}/runs?head_sha=${headSha}&per_page=20`)
      return r.workflow_runs
    },

    // Plays a teammate: opens a PR from a bot/ branch with the edit, squash-merges
    // it, and returns the commit that landed on main.
    async botMerge({ branch, title, body, edit }) {
      const mainSha = await getRefSha('main')
      const sha = await commitOnTop(mainSha, edit, title)
      await request('DELETE', `${R}/git/refs/heads/${branch}`, null, { allowMissing: true })
      await request('POST', `${R}/git/refs`, { ref: `refs/heads/${branch}`, sha })
      const pr = await request('POST', `${R}/pulls`, { title, body, head: branch, base: 'main' })
      // 405 = GitHub hasn't finished checking the new PR yet; try again shortly.
      const merged = await request('PUT', `${R}/pulls/${pr.number}/merge`, { merge_method: 'squash', commit_title: `${title} (#${pr.number})` }, { retries: 5, retryOn: [405] })
      await request('DELETE', `${R}/git/refs/heads/${branch}`, null, { allowMissing: true })
      await removeRuns(sha)
      return { sha: merged.sha, pr: pr.number }
    },

    // Plays a teammate pushing to the player's branch. Fails rather than
    // overwriting if the branch moved in the meantime.
    async botPush(branch, edit, message) {
      const head = await getRefSha(branch)
      const sha = await commitOnTop(head, edit, message)
      await request('PATCH', `${R}/git/refs/heads/${branch}`, { sha, force: false })
      return sha
    },
  }
}
