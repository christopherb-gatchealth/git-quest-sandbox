@{{player}} you're not alone on this repo: a teammate has just merged a change into `main`.

## Goal

Learn the two everyday sync habits: **pull before you branch**, and **pull when your push is rejected**.

## Part 1: start from fresh `main`

1. Bring your `main` up to date, then branch:

   ```bash
   git switch main
   git pull
   git switch -c feat/about-{{playerLower}}
   ```

2. Create `about/{{player}}.md` with three lines about you (name, role, one thing you want to learn).
3. Commit and push:

   ```bash
   git add about/{{player}}.md
   git commit -m "Add an about page for {{player}}"
   git push -u origin feat/about-{{playerLower}}
   ```

## Part 2: a teammate pushes to your branch

Once I see your push, a teammate will push a commit to **your branch** and I'll comment here. Then:

1. Add a 4th line to `about/{{player}}.md`, commit it, and `git push`.
2. The push is **rejected**, because GitHub has a commit you don't. Read the message, then:

   ```bash
   git pull --no-edit    # fetch their commit and merge it with yours
   git push
   ```

   Never use `git push --force` to get past a rejection: it deletes the other person's work.

## Part 3: merge

Open a PR for the branch, fill in the template, and **Squash and merge** it.

## Done when

The PR is merged, and its branch contained both the teammate's commit and yours.
