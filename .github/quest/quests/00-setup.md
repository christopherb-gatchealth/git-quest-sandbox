@{{player}} welcome to **Git Quest**! Ten quests take you from zero to the git workflow GATC's frontend team uses every day. Each one earns XP, and your progress, rank and achievements live in the Quest Log, #{{logIssue}}.

**How it works:** each quest is an issue like this one. Do the steps, and a bot checks your work and opens the next quest. Comment `/hint` if you're stuck (each hint costs a little XP).

## Goal

Set up git, GitHub and an SSH key on your Mac, then clone this repo.

## Steps

1. **Accept the invite.** You were invited to `{{owner}}/{{repo}}`. Accept it from your email or at https://github.com/notifications.

2. **Check git is installed.** Open **Terminal** (press `Cmd+Space`, type "Terminal") and run:

   ```bash
   git --version
   ```

   If macOS offers to install the "command line developer tools", click **Install**, wait, then run it again.

3. **Tell git who you are.** Use an email that's verified on your GitHub account (**Settings → Emails**). The private `…@users.noreply.github.com` address shown there works too.

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   git config --global init.defaultBranch main
   git config --global pull.rebase false
   git config --global core.editor nano
   ```

   The last two lines make `git pull` merge (the simplest option) and use the beginner-friendly `nano` editor if git ever asks you to type a message.

4. **Make an SSH key** so GitHub knows it's you without a password:

   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"   # press Enter three times to accept the defaults
   pbcopy < ~/.ssh/id_ed25519.pub                 # copies your PUBLIC key
   ```

   On GitHub, go to **Settings → SSH and GPG keys → New SSH key**, paste it, and save. Your *private* key (the file without `.pub`) never leaves your Mac.

5. **Clone the repo** over SSH:

   ```bash
   mkdir -p ~/code && cd ~/code
   git clone git@github.com:{{owner}}/{{repo}}.git
   cd {{repo}}
   ```

   If it asks "Are you sure you want to continue connecting?", type `yes`.

6. **Run the checker:**

   ```bash
   ./quest check
   ```

   It tests everything above and, if it all works, prints a code.

## Done when

You comment `/verify <code>` on this issue, using the code the checker printed.
