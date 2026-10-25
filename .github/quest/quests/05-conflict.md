@{{player}} sometimes two people change the same line. Git can't guess who's right, so it asks you. That's a **merge conflict**, and it's routine.

## Goal

Hit a real conflict and resolve it.

## Steps

1. Start a branch from fresh `main`:

   ```bash
   git switch main
   git pull
   git switch -c feat/favorite-editor
   ```

2. In `config/settings.md`, change the line `favorite_editor: TBD` to your favourite editor, for example `favorite_editor: vscode`.
3. Commit, push, and open a PR (template filled in, as always):

   ```bash
   git add config/settings.md
   git commit -m "Set my favourite editor"
   git push -u origin feat/favorite-editor
   ```

4. Wait for my comment on the PR. A teammate will merge a change to the same line, and your PR will show a conflict.
5. Resolve it on your laptop with the commands in my comment. When you open the file, you'll see:

   ```text
   <<<<<<< HEAD
   favorite_editor: vscode
   =======
   favorite_editor: vim (picked by the team)
   >>>>>>> main
   ```

   The top half is yours, the bottom half is `main`'s. Edit it to the single line you want, delete all three marker lines, save, then `git add`, `git commit --no-edit` and `git push`.
6. Once I confirm it's clean, **Squash and merge**.

## Done when

The PR is merged, with `main`'s change included and no conflict markers left.
