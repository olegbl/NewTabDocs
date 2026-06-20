import type { ConflictState } from '../types'

interface Props {
  conflict: ConflictState
  onResolve: (winner: 'local' | 'remote') => void
}

export default function ConflictDialog({ onResolve }: Props) {
  return (
    <div>
      <button onClick={() => onResolve('local')}>Keep local</button>
      <button onClick={() => onResolve('remote')}>Use Drive copy</button>
    </div>
  )
}
