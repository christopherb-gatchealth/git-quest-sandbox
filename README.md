# Git Quest

![Rank](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fchristopherb-gatchealth%2Fgit-quest-sandbox%2Fquest-state%2Fstate.json&query=%24.rank&label=rank&color=7057ff)
![XP](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fchristopherb-gatchealth%2Fgit-quest-sandbox%2Fquest-state%2Fstate.json&query=%24.xp&label=XP&color=fbca04)
![Level](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fchristopherb-gatchealth%2Fgit-quest-sandbox%2Fquest-state%2Fstate.json&query=%24.level_label&label=quests%20done&color=2ea44f)

Ten quests that teach the git and GitHub workflow used on GATC's frontend:
branches, commits, pull requests, review, staying in sync, merge conflicts,
reverts, keeping secrets out, local rescue skills, and a final boss where you
ship a tested React component through CI.

**Playing?** Open the **Issues** tab. The issue labelled `quest` is your
current quest, and the `quest-log` issue tracks your XP, rank and
achievements.

## The quests

| # | Quest | You'll learn | XP |
| --- | --- | --- | --- |
| 0 | Set up your tools | git config, SSH keys, cloning | 50 |
| 1 | Your first commit | branches, `add`, `commit`, `push` | 100 |
| 2 | Open a pull request | PR titles and descriptions | 150 |
| 3 | Survive code review | updating a PR, replying, merging | 150 |
| 4 | Stay in sync | `pull` before branching, rejected pushes | 150 |
| 5 | Resolve a merge conflict | conflict markers, `merge` | 250 |
| 6 | Undo a bad commit | `revert` vs rewriting history | 200 |
| 7 | Secret leak drill | `.gitignore`, cleaning a branch, rotating keys | 200 |
| 8 | Local labs | `restore`, `restore --staged`, `stash`, `log -S` | 200 |
| 9 | Boss level | a React component, tests, CI, review | 500 |

Ranks: **Intern** (0) → **Committer** (400) → **Reviewer** (1000) →
**Maintainer** (1600). Each `/hint` costs 10% of that quest's XP, and a few
mistakes (like force-pushing over a teammate) cost more. Some achievements
are hidden.

## What's in the repo

| Path | What it is |
| --- | --- |
| `hello.md`, `about/`, `config/` | Files the quests ask you to change |
| `app/` | A small Next.js app for the boss level |
| `quest` | A helper for setup checks and local labs: `./quest help` |
| `.github/quest/` | The quest engine and quest texts (no peeking!) |
| `.github/workflows/` | The automation: quest engine, secret scan, app CI |
