type FieldCoachProps = {
  hint: string
  example: string
  avoid: string
}

export function FieldCoach({ hint, example, avoid }: FieldCoachProps) {
  return (
    <div className="field-coach">
      <p>{hint}</p>
      <span>Good: {example}</span>
      <span>Avoid: {avoid}</span>
    </div>
  )
}
