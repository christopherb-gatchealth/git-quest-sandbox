@{{player}} this quest makes a classic mistake **on purpose**: committing a secret. Better to learn it here than at work.

Every real repo, including GATC's, scans PRs for passwords and API keys. Here, a **secret scan** check runs on every PR.

## Goal

Commit a fake secret, watch the scan catch it, then clean it out of your branch's history before it reaches `main`.

## Part 1: make the mistake

```bash
git switch main
git pull
git switch -c chore/local-config
echo "API_KEY={{data.secret}}" > .env
git add .env
git commit -m "Add local config"
git push -u origin chore/local-config
```

Open a PR (template filled in) and watch the checks at the bottom. The secret scan goes red, and I'll comment.

## Part 2: clean it up

Deleting the file in a new commit isn't enough: the key would still be in the earlier commit, where anyone can read it. You need to remove that commit. I'll post the exact commands on your PR; in short:

1. Undo the commit but keep the files (`git reset --soft`).
2. Unstage `.env` and add `.env` to `.gitignore`, so git ignores it from now on.
3. Commit, then `git push --force-with-lease`.

Force-pushing is fine **only** on a branch that's yours alone. And in real life, a leaked key must be **cancelled (rotated)** straight away, even after cleaning up: it was public for a while.

## Done when

The PR is merged, its commits contain no secret, and `main` has `.env` in `.gitignore`.
