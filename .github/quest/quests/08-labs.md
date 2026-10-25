@{{player}} some git skills only happen on your laptop, where GitHub can't see them. These four labs run there.

Each lab builds a small practice repo in `~/git-quest-lab/`. Fix the situation, run the verify command, and comment `/verify <code>` here with the code it prints.

## The labs

| Lab | Situation | Skill |
| --- | --- | --- |
| `restore` | You typed over a file by accident. Get it back. | `git restore <file>` |
| `unstage` | You staged two files but only one should go in the commit. | `git restore --staged <file>` |
| `stash` | You're mid-feature when an urgent fix is needed on `main`. | `git stash`, `git stash pop` |
| `detective` | Someone turned on a debug flag. Find out who. | `git log -S`, `git show` |

## How to run one

From your clone of this repo:

```bash
./quest lab restore        # sets up the lab and explains the task
cd ~/git-quest-lab/restore
# ...fix it with git...
cd -                       # back to the quest repo
./quest verify restore     # checks your work and prints a code
```

For the detective lab, give your answer: `./quest verify detective <name>`.

## Done when

All four codes are verified on this issue. Do them in any order.
