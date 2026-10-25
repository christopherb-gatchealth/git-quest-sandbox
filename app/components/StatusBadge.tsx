import type { Status } from '@/lib/molecules'

interface StatusBadgeProps {
  status: Status
  score: number
}

const LABELS: Record<Status, string> = { pass: 'Pass', warn: 'Warn', fail: 'Fail' }

export default function StatusBadge({ status, score }: StatusBadgeProps) {
  return (
    <span className="inline-flex gap-1 text-xs">
      <span>{LABELS[status]}</span>
      <span>{(score * 100).toFixed(1)}%</span>
    </span>
  )
}
