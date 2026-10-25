# Mentor guide

How to run Git Quest for a new player.

## One-time repo setup

These need admin rights on the repo, so the mentor runs them (from a clone,
with `gh` logged in).

```bash
REPO=christopherb-gatchealth/git-quest

# Squash merges only, and tidy up branches after merging
gh api -X PATCH repos/$REPO -F allow_squash_merge=true -F allow_merge_commit=false \
  -F allow_rebase_merge=false -F delete_branch_on_merge=true -F is_template=true

# Let the workflows write, and let the bot approve PRs
gh api -X PUT repos/$REPO/actions/permissions/workflow \
  -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true

# Protect main: changes only through PRs, no force pushes, no deleting it
gh api -X POST repos/$REPO/rulesets --input - <<'JSON'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } }
  ]
}
JSON
```

## Starting a player

1. Set `player` in `.github/quest/config.json` to their GitHub username, and
   `mentor` to yours (you get a mention when they finish).
2. Invite them: `gh api -X PUT repos/$REPO/collaborators/<username> -f permission=push`
3. Start the game: `gh workflow run quest.yml -f action=start`, or
   **Actions → Quest Engine → Run workflow**.

Quest 0 opens as an issue that mentions them, so GitHub emails them.

## While they play

- The `quest-log` issue shows their progress. Watch the repo to follow along.
- Stuck on something the bot doesn't handle? Run the workflow with `skip`
  to pass the current quest (0 XP for it).
- Something broke? **Actions → Quest Engine** shows every run and its log.

## Running it again

The game changes files on `main` as it's played, so for a new player, make a
fresh copy: **Use this template** on this repo, then repeat the setup above
on the copy (and update the badge URLs in its README). To restart the same
player in place, run the workflow with `reset`, then `start`.

## How it works

`.github/workflows/quest.yml` runs `.github/quest/engine/main.mjs` on every
push, PR, comment and CI run. The engine keeps the game state in `state.json`
on the `quest-state` branch, and acts as "teammates" by merging small PRs
from `bot/` branches. Each quest's checks are in
`.github/quest/engine/quests.mjs`, and its text in `.github/quest/quests/`.
Run the engine's tests with `node --test .github/quest/engine/test/`.
