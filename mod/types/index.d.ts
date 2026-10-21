export type Option = { label: string; description?: string }

export type Question = {
  question: string
  header: string
  kind?: 'choice' | 'text' | 'number'
  description?: string
  options?: Option[]
  multiSelect?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  unit?: string
}

export type Answer = {
  picked: string[]
  isOther: boolean
  other: string
  text: string
}

export type Form = {
  questions: Question[]
  step: number
  answers: Record<number, Answer>
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'ask-form': { form: Form | null }
  }
}
