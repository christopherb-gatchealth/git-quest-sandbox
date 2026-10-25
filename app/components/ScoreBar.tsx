interface ScoreBarProps {
  // A value from 0 to 1
  score: number
}

// An example component to copy from in Quest 9: typed props, Tailwind
// classes, and a matching test file next to it.
export default function ScoreBar({ score }: ScoreBarProps) {
  const percent = Math.min(100, Math.max(0, score * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 rounded-full bg-slate-200" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full bg-slate-500" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600">{percent.toFixed(0)}</span>
    </div>
  )
}
