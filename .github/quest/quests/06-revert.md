@{{player}} someone merged a bad change: commit `{{data.badShort}}`, *"Add an experimental banner"*, put a broken line in `hello.md` and added `banner.txt`. Your job: undo it, safely.

## Goal

Undo a commit that's already on `main`, using `git revert`.

`git revert` adds a **new** commit that does the opposite of the old one. History stays intact, so nobody else's copy breaks. (Commands that *rewrite* history, like `git reset`, are only for commits nobody else has.)

## Steps

1. Get the latest `main` and find the commit:

   ```bash
   git switch main
   git pull
   git log --oneline -5
   ```

   You'll see `{{data.badShort}} Add an experimental banner (#…)` near the top.

2. Revert it on a branch:

   ```bash
   git switch -c fix/revert-banner
   git revert --no-edit {{data.badShort}}
   git push -u origin fix/revert-banner
   ```

3. Open a PR, fill in the template (the "why" is easy this time), and **Squash and merge**.

## Done when

`main` no longer has the broken line or `banner.txt`, and the fix came from a `git revert` commit.
