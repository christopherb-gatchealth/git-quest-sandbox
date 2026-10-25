@{{player}} final quest. Everything comes together: a real code change to a real Next.js app, with tests, CI and review. This is exactly how work on GATC's frontend flows.

## The mission

The practice app in `app/` lists four molecules with a toxicity status, but the status is plain text. Build a `StatusBadge` component and use it on the page.

## The spec

Create `app/components/StatusBadge.tsx`:

- Props: `status` (`'pass' | 'warn' | 'fail'`, use the `Status` type from `@/lib/molecules`) and `score` (a number from 0 to 1).
- Shows the label **Pass**, **Warn** or **Fail**.
- Shows the score as a percentage with one decimal, so `0.183` reads **18.3%**.
- Its outer element has a `data-status` attribute set to the status.
- Colour by status, using the Tailwind colours `text-status-ok`, `text-status-warning` and `text-status-critical`.

Then use it for each row in `app/app/page.tsx` (look for the `Quest 9` comment), and write `app/components/StatusBadge.test.tsx` with at least one test of your own.

## Steps

1. Get set up. You'll need Node.js 20 or newer: check with `node --version`, or install it from https://nodejs.org.

   ```bash
   git switch main
   git pull
   git switch -c feat/status-badge
   cd app
   npm install
   npm test          # the Quest 9 acceptance tests fail: that's your target
   ```

2. Build the component, use it on the page, and write your test. `components/ScoreBar.tsx` and its test show the pattern.
3. Check it all on your laptop:

   ```bash
   npm test          # everything green
   npm run build     # also catches type errors
   npm run dev       # look at it on http://localhost:3000
   ```

4. Commit in small steps, push, and open a PR with the template filled in. Include a screenshot of the page in the description if you can.
5. **App CI** runs the tests and the build on your PR. When it's green, I'll approve. Then **Squash and merge**.

## Done when

The PR is merged with `StatusBadge.tsx` and its test, and CI was green on the final commit.

Good luck. The acceptance tests in `app/acceptance/` say exactly what "done" means; don't edit them.
