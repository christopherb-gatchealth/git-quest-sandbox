# Molecule screen (practice app)

A tiny Next.js 14 app, built the same way as GATC's real frontend: the App
Router, TypeScript, Tailwind and Vitest. You'll work on it in Quest 9.

```bash
cd app
npm install      # once
npm run dev      # http://localhost:3000
npm test         # run the tests
npm run build    # production build; also catches type errors
```

| Path | What's there |
| --- | --- |
| `app/page.tsx` | The only page |
| `components/` | UI pieces, each with a `.test.tsx` next to it |
| `lib/molecules.ts` | The sample data and its types |
| `acceptance/` | Quest 9's acceptance tests. Don't edit these. |
