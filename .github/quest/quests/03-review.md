@{{player}} a reviewer has looked at PR #{{data.pr}} and asked for a change. This happens on nearly every PR, so it's a skill, not a failure.

## Goal

Make the requested change, reply to the reviewer, get approved, and merge.

## Steps

1. Open PR #{{data.pr}} and read the review. My comment is on `hello.md` in the **Files changed** tab.
2. Make the change on **the same branch**. Your PR updates automatically when you push:

   ```bash
   git switch feat/hello-{{playerLower}}   # or whatever your branch is called
   # add a line starting with "Fun fact:" to hello.md, under your entry
   git add hello.md
   git commit -m "Add a fun fact"
   git push
   ```

3. Reply to my comment: in **Files changed**, click **Reply...** under it and say what you did.
4. Wait for my approval (a green tick).
5. Click **Squash and merge**, confirm, then **Delete branch**. Squash merging turns all the PR's commits into a single commit on `main`, which is how the team merges.
6. Tidy up your laptop:

   ```bash
   git switch main
   git pull
   git branch -D feat/hello-{{playerLower}}
   ```

   It's `-D`, not `-d`, because after a squash merge git can't tell the branch was merged. That's normal.

## Done when

The PR is merged after my approval. Merging before approval costs XP, so wait for the green tick.
