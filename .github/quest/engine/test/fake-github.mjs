// An in-memory stand-in for the GitHub client in github.mjs: a tiny commit
// graph, branches, issues and PRs, plus a record of everything the bot said.
export class FakeGitHub {
  constructor(initialFiles = {}) {
    this.owner = 'mentor'
    this.repo = 'git-quest'
    this.commits = new Map()
    this.refs = new Map()
    this.issues = new Map()
    this.pulls = new Map()
    this.patches = new Map() // sha -> [{ patch }]
    this.runs = new Map() // sha -> [{ conclusion }]
    this.reviews = []
    this.labels = new Set()
    this.state = null
    this.stateSha = null
    this.nextNumber = 1
    this.nextId = 1000
    this.seq = 0
    this.refs.set('main', this.commit([], initialFiles, 'Initial commit'))
  }

  // ── Test helpers ──────────────────────────────────────────────────────────
  commit(parents, changes, message = 'change', login = null) {
    const base = parents.length ? { ...this.commits.get(parents[0]).files } : {}
    for (const [p, c] of Object.entries(changes)) {
      if (c === null) delete base[p]
      else base[p] = c
    }
    const sha = `c${String(++this.seq).padStart(6, '0')}`
    this.commits.set(sha, { parents, files: base, message, login })
    return sha
  }
  ancestors(sha) {
    const seen = new Set()
    const stack = [sha]
    while (stack.length) {
      const s = stack.pop()
      if (seen.has(s)) continue
      seen.add(s)
      stack.push(...this.commits.get(s).parents)
    }
    return seen
  }
  resolve(ref) {
    return this.refs.get(ref) ?? (this.commits.has(ref) ? ref : null)
  }
  openPull({ head, title, body, login }) {
    const n = this.nextNumber++
    this.issues.set(n, { number: n, title, body, comments: [], state: 'open', labels: [], pr: true })
    const pr = { number: n, title, body, head: { ref: head, sha: this.refs.get(head) }, base: { ref: 'main' }, user: { login }, merged: false, mergeable: true, files: [], commits: [] }
    this.pulls.set(n, pr)
    return pr
  }
  // Squash-merges a PR, as the player clicking "Squash and merge" would.
  mergePull(n) {
    const pr = this.pulls.get(n)
    const files = this.commits.get(pr.head.sha).files
    const changes = {}
    const mainFiles = this.commits.get(this.refs.get('main')).files
    for (const p of new Set([...Object.keys(files), ...Object.keys(mainFiles)])) {
      if (files[p] !== mainFiles[p]) changes[p] = files[p] ?? null
    }
    this.refs.set('main', this.commit([this.refs.get('main')], changes, pr.title))
    pr.merged = true
    this.issues.get(n).state = 'closed'
    return pr
  }
  said(n) {
    return this.issues.get(n).comments.join('\n---\n')
  }

  // ── The client interface ──────────────────────────────────────────────────
  async readState() {
    return this.state ? { state: JSON.parse(JSON.stringify(this.state)), sha: this.stateSha } : null
  }
  async writeState(state, sha) {
    if (this.stateSha && sha !== this.stateSha) throw new Error('state sha mismatch')
    this.state = JSON.parse(JSON.stringify(state))
    this.stateSha = `s${++this.seq}`
    return this.stateSha
  }
  async deleteState() {
    this.state = null
    this.stateSha = null
  }
  async ensureLabel(name) {
    this.labels.add(name)
  }
  async createIssue(title, body, labels = []) {
    const n = this.nextNumber++
    this.issues.set(n, { number: n, title, body, comments: [], state: 'open', labels })
    return { number: n }
  }
  async updateIssue(n, fields) {
    Object.assign(this.issues.get(n), fields)
  }
  async comment(n, body) {
    this.issues.get(n).comments.push(body)
  }
  async listOpenIssues(label) {
    return [...this.issues.values()].filter((i) => i.state === 'open' && i.labels.includes(label))
  }
  async getPull(n) {
    return this.pulls.get(n)
  }
  async getMergeable(n) {
    return this.pulls.get(n).mergeable
  }
  async listPullFiles(n) {
    return this.pulls.get(n).files
  }
  async listPullCommits(n) {
    return this.pulls.get(n).commits
  }
  async getCommit(sha) {
    return { files: this.patches.get(sha) || [] }
  }
  async review(n, event, body) {
    this.reviews.push({ n, event, body })
  }
  async fileComment(n, { body }) {
    this.issues.get(n).comments.push(body)
    return { id: this.nextId++ }
  }
  async getFile(path, ref) {
    const sha = this.resolve(ref)
    return sha ? (this.commits.get(sha).files[path] ?? null) : null
  }
  async getRefSha(branch) {
    return this.refs.get(branch) ?? null
  }
  async compare(base, head) {
    const b = this.resolve(base)
    const h = this.resolve(head)
    // Like GitHub: commits on head that base lacks (oldest first), and the
    // files that differ between the two.
    const onBase = this.ancestors(b)
    const commits = [...this.ancestors(h)].filter((s) => !onBase.has(s)).sort().map((s) => {
      const c = this.commits.get(s)
      return { sha: s, author: c.login ? { login: c.login } : null, commit: { message: c.message, author: { email: 'n@example.com' } } }
    })
    const bf = this.commits.get(b).files
    const hf = this.commits.get(h).files
    const files = [...new Set([...Object.keys(bf), ...Object.keys(hf)])].filter((p) => bf[p] !== hf[p]).map((filename) => ({ filename }))
    const status = b === h ? 'identical' : onBase.has(h) ? 'behind' : this.ancestors(h).has(b) ? 'ahead' : 'diverged'
    return { status, commits, files }
  }
  async workflowRuns(_file, sha) {
    return this.runs.get(sha) || []
  }
  async botMerge({ title, edit }) {
    const main = this.refs.get('main')
    const changes = await edit((p) => this.getFile(p, main))
    const sha = this.commit([main], changes, title)
    this.refs.set('main', sha)
    return { sha, pr: this.nextNumber++ }
  }
  async botPush(branch, edit, message) {
    const head = this.refs.get(branch)
    const changes = await edit((p) => this.getFile(p, head))
    const sha = this.commit([head], changes, message)
    this.refs.set(branch, sha)
    return sha
  }
}
