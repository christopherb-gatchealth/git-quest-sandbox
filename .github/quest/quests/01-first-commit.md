@{{player}} time for your first commit.

## Goal

Make a commit on your own branch and push it to GitHub.

`main` is protected here, just like at work: nobody pushes to it directly. Every change starts on a **branch**, a separate line of work you can share without touching `main`.

## Steps

1. Get the latest `main`:

   ```bash
   git switch main
   git pull
   ```

2. Create a branch. Team branch names start with `feat/`, `fix/` or `chore/`, in lowercase:

   ```bash
   git switch -c feat/hello-{{playerLower}}
   ```

3. Open `hello.md` (in VS Code, or `nano hello.md`) and add a line under **Players**:

   ```markdown
   - {{player}}: hello! I'm learning git.
   ```

4. Look at what changed, then **stage** and **commit** it:

   ```bash
   git status          # hello.md is "modified"
   git diff            # the exact lines you changed
   git add hello.md    # stage it: "this goes in the next commit"
   git commit -m "Add {{player}} to the players list"
   ```

5. **Push** the branch to GitHub:

   ```bash
   git push -u origin feat/hello-{{playerLower}}
   ```

   `-u` links your local branch to the one on GitHub, so next time plain `git push` is enough.

## Done when

A `feat/`, `fix/` or `chore/` branch arrives on GitHub with a commit that changes `hello.md`, made with an email linked to your account.

## Why it matters

Small commits with clear messages are how the team reads history. Look at `git log --oneline` in any repo: each line should say *what changed*, in plain words.
