import type { Answer, Form, Question } from '../types'

export const EMPTY: Answer = { picked: [], isOther: false, other: '', text: '' }

export const answerOf = (form: Form, i: number): Answer => form.answers[i] ?? EMPTY

export const kindOf = (q: Question) => q.kind ?? 'choice'

/** The answer as the tool reports it, or undefined while the question is unanswered. */
export const render = (q: Question, a: Answer): string | undefined => {
  if (kindOf(q) !== 'choice') {
    return a.text.trim() === '' ? undefined : a.text.trim()
  }
  const other = a.isOther && a.other.trim() !== '' ? [a.other.trim()] : []
  const parts = q.multiSelect ? [...a.picked, ...other] : other.length > 0 ? other : a.picked.slice(0, 1)

  return parts.length === 0 ? undefined : parts.join(', ')
}

export const collect = (form: Form): Record<string, string> => {
  const answers: Record<string, string> = {}
  form.questions.forEach((q, i) => {
    const text = render(q, answerOf(form, i))
    if (text !== undefined) answers[q.question] = text
  })

  return answers
}

export const patch = (form: Form, i: number, change: Partial<Answer>): Form => ({
  ...form,
  error: undefined,
  answers: { ...form.answers, [i]: { ...answerOf(form, i), ...change } },
})

export const go = (form: Form, step: number): Form => ({
  ...form,
  error: undefined,
  step: Math.max(0, Math.min(form.questions.length, step)),
})

export const toggle = (list: string[], label: string): string[] =>
  list.includes(label) ? list.filter(x => x !== label) : [...list, label]

/** Parses a number answer; a string when it is accepted, else the reason. */
export const parseNumber = (q: Question, raw: string): { value: string } | { error: string } => {
  const n = Number(raw.trim())
  if (raw.trim() === '' || Number.isNaN(n)) return { error: 'Enter a number' }
  if (q.min !== undefined && n < q.min) return { error: `Minimum is ${q.min}` }
  if (q.max !== undefined && n > q.max) return { error: `Maximum is ${q.max}` }

  return { value: String(n) }
}
