import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Answer, Form, Question } from '../types'
import { answerOf, collect, go, kindOf, parseNumber, patch, render, toggle } from './logic'

const PANE = 'ask-form'
const form = atom({ plugin: 'ask-form', key: 'form' } as const, null)

type Outcome = { isCancelled: boolean }

// The form as last written: the hook that waits for the answers reads it here,
// since a state read outside a render does not see the handlers' later writes.
let latest: Form | null = null

function edit($: Parameters<typeof update>[0], fn: (f: Form) => Form) {
  return update($, form, f => {
    latest = f === null ? f : fn(f)

    return latest
  })
}

const FORM_RULE = {
  id: 'ask-form:rule',
  scope: 'session',
  text: [
    'Asking the user questions:',
    '- Whenever you need an answer, a decision or a missing detail from the user, call the AskUserQuestion tool. Never write the questions as plain text in the chat, and do not ask them before calling it.',
    '- This applies to every question, including simple yes/no ones and questions a skill tells you to ask.',
    '- Put the recommended option first and end its label with "(Recommended)".',
    '- Batch related questions into one call (up to 4). Use multiSelect when several answers can apply, and kind "text" or "number" for open-ended input.',
    '- A free-text "Type your own answer" option is always offered by the form, so do not add an "Other" option.',
  ].join('\n'),
} as const

export const register: Register = (on, options) => {
  let finish: ((o: Outcome) => void) | null = null

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const questions = e.questions as unknown as Question[]
    const opened = await $.ui.open({
      id: PANE,
      title: 'Questions',
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
      rows: 18,
    })
    // No surface to draw on (headless, narrow): the engine's own dialog asks.
    if (!opened.isPlaced) return next(e)

    latest = { questions, step: 0, answers: {} }
    await update($, form, () => latest)
    const outcome = await new Promise<Outcome>(resolve => {
      finish = resolve
    })
    finish = null
    const done = latest
    latest = null
    await update($, form, () => null)
    await $.ui.close({ id: PANE })

    if (outcome.isCancelled || done === null) {
      return { deny: 'The user dismissed the questions without answering.' }
    }

    return { result: { questions: e.questions, answers: collect(done) } }
  }).catch(async ($, e, next) => {
    finish = null
    await $.ui.close({ id: PANE })

    return next(e)
  })

  if (options.enforceForm !== false) {
    on('prompt.compose', async ($, e, next) => {
      const { sections } = await next(e)

      return { sections: [...sections, FORM_RULE] }
    }).catch(($, e, next) => next(e))
  }

  on('ui.close', ($, e, next) => {
    if (e.id === PANE && finish !== null) finish({ isCancelled: true })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const f = await read($, form)
    // The mobile app draws no Input yet; leave the pane to the engine there.
    if (f === null || e.surface === 'mobile') return next(e)

    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const total = f.questions.length
    const isReview = f.step >= total
    const q = f.questions[f.step]

    const tabs = (
      <Box>
        {f.questions.map((one, i) => {
          const isDone = render(one, answerOf(f, i)) !== undefined
          const mark = isDone ? '✓' : '○'
          return (
            <Button
              key={`tab-${i}`}
              plain
              onPress={() => edit($, x => go(x, i))}
            >
              {i === f.step ? <Text bold color="cyan">{`${mark} ${one.header}`}</Text> : <Text dimColor={!isDone}>{`${mark} ${one.header}`}</Text>}
              {'  '}
            </Button>
          )
        })}
        <Button key="tab-review" plain onPress={() => edit($, x => go(x, total))}>
          {isReview ? <Text bold color="cyan">Confirm</Text> : <Text dimColor>Confirm</Text>}
        </Button>
      </Box>
    )

    const nav = (
      <Box>
        {f.step > 0 && (
          <Button key="back" plain hotkey="b" onPress={() => edit($, x => go(x, x.step - 1))}>
            ← back{'   '}
          </Button>
        )}
        {!isReview && (
          <Button key="next" plain hotkey="n" onPress={() => edit($, x => go(x, x.step + 1))}>
            next →{'   '}
          </Button>
        )}
        <Button key="cancel" plain hotkey="x" onPress={() => finish?.({ isCancelled: true })}>
          x: cancel
        </Button>
      </Box>
    )

    if (isReview || q === undefined) {
      return (
        <Box flexDirection="column">
          {tabs}
          <Text bold>Review your answers</Text>
          {f.questions.map((one, i) => (
            <Text>
              <Text dimColor>{one.header}: </Text>
              {render(one, answerOf(f, i)) ?? <Text dimColor>(no answer)</Text>}
            </Text>
          ))}
          <Box>
            <Button key="submit" variant="primary" hotkey="s" onPress={() => finish?.({ isCancelled: false })}>
              Submit
            </Button>
            <Text>  </Text>
            {nav}
          </Box>
        </Box>
      )
    }

    const a: Answer = answerOf(f, f.step)
    const i = f.step
    const kind = kindOf(q)
    const advance = () => edit($, x => go(x, x.step + 1))
    const options = q.options ?? []

    const choice = () => (
      <Box flexDirection="column">
        {options.map((o, n) => {
          const isOn = a.picked.includes(o.label)
          const box = q.multiSelect ? (isOn ? '[x]' : '[ ]') : isOn ? '(•)' : '( )'
          return (
            <Button
              key={`opt-${n}`}
              plain
              hotkey={String(n + 1)}
              onPress={() =>
                q.multiSelect
                  ? edit($, x => patch(x, i, { picked: toggle(answerOf(x, i).picked, o.label) }))
                  : edit($, x => go(patch(x, i, { picked: [o.label], isOther: false }), x.step + 1))
              }
            >
              {box} {o.label}
              {o.description ? <Text dimColor>{`  ${o.description}`}</Text> : ''}
            </Button>
          )
        })}
        <Button
          key="opt-other"
          plain
          hotkey="o"
          onPress={() =>
            edit($, x =>
              patch(x, i, q.multiSelect ? { isOther: !answerOf(x, i).isOther } : { isOther: true, picked: [] }),
            )
          }
        >
          {q.multiSelect ? (a.isOther ? '[x]' : '[ ]') : a.isOther ? '(•)' : '( )'} Type your own answer
        </Button>
        {a.isOther && (
          <Input
            key={`other-${i}`}
            label="  › "
            placeholder="Your answer"
            value={a.other}
            autoFocus
            submitLabel={q.multiSelect ? 'save' : 'next'}
            onInput={v => edit($, x => patch(x, i, { other: v }))}
            onSubmit={v => {
              edit($, x => patch(x, i, { other: v }))
              if (!q.multiSelect) advance()
            }}
          />
        )}
      </Box>
    )

    const field = () => (
      <Box flexDirection="column">
        <Input
          key={`text-${i}`}
          label="› "
          placeholder={q.placeholder ?? (kind === 'number' ? `${q.min ?? ''}–${q.max ?? ''}` : 'Your answer')}
          value={a.text || (kind === 'number' && q.defaultValue !== undefined && a.text === '' ? '' : a.text)}
          autoFocus
          submitLabel="next"
          onInput={v => edit($, x => patch(x, i, { text: v }))}
          onSubmit={v => {
            if (kind === 'number') {
              const parsed = parseNumber(q, v)
              if ('error' in parsed) {
                edit($, x => ({ ...x, error: parsed.error }))
                return
              }
              edit($, x => go(patch(x, i, { text: parsed.value }), x.step + 1))
              return
            }
            edit($, x => go(patch(x, i, { text: v }), x.step + 1))
          }}
        />
        {kind === 'number' && (
          <Text dimColor>
            {[q.min !== undefined && `min ${q.min}`, q.max !== undefined && `max ${q.max}`, q.unit, q.defaultValue !== undefined && `default ${q.defaultValue}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {tabs}
        <Text bold>{q.question}</Text>
        {q.description ? <Text dimColor>{q.description}</Text> : ''}
        {q.multiSelect && kind === 'choice' ? <Text dimColor>Select all that apply · enter toggles · n: next</Text> : ''}
        {kind === 'choice' ? choice() : field()}
        {f.error ? <Text color="red">{f.error}</Text> : ''}
        <Text dimColor>↑/↓ move · enter select · 1-4 pick · o: own answer · b/n: back/next · esc cancel</Text>
        {nav}
      </Box>
    )
  })
}
