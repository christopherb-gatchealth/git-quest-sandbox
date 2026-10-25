import type { Status } from '@/lib/molecules'

interface StatusBadgeProps {
  status: Status
  score: number
}

const COLORS: Record<Status, string> = { pass: 'text-status-ok', warn: 'text-status-warning', fail: 'text-status-critical' }

const LABELS: Record<Status, string> = { pass: 'Pass', warn: 'Warn', fail: 'Fail' }

export default function StatusBadge({ status, score }: StatusBadgeProps) {
  return (
    <span data-status={status} className={`inline-flex gap-1 text-xs ${COLORS[status]}`}>
      <span>{LABELS[status]}</span>
      <span>{(score * 100).toFixed(1)}%</span>
    </span>
  )
}
