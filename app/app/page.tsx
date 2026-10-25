import ScoreBar from '@/components/ScoreBar'
import { MOLECULES } from '@/lib/molecules'

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-1">Molecule screen</h1>
      <p className="text-slate-600 mb-6">Predicted toxicity for four sample molecules.</p>
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            <th className="py-2">Molecule</th>
            <th className="py-2">SMILES</th>
            <th className="py-2">Score</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {MOLECULES.map((m) => (
            <tr key={m.id} className="border-t border-slate-200">
              <td className="py-3 font-medium">{m.name}</td>
              <td className="py-3 font-mono text-xs text-slate-600">{m.smiles}</td>
              <td className="py-3"><ScoreBar score={m.score} /></td>
              {/* Quest 9: replace this plain text with <StatusBadge status={m.status} score={m.score} /> */}
              <td className="py-3 text-sm">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
