type StageProgressProps = {
  label: string | null
}

export function StageProgress({ label }: StageProgressProps) {
  if (!label) return null

  return (
    <p className="stage-progress" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  )
}
