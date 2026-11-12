import { describe, expect, test } from 'bun:test'
import { sidecarParameters, withOutputLanguage } from '../src/generation-options'
import { createEmptyTimelineState } from '../src/shared'

const settings = () => createEmptyTimelineState().settings

describe('Vertex-safe generation parameters', () => {
  test('never sends penalty fields to Vertex, Google, Anthropic or Bedrock', () => {
    const s = { ...settings(), presencePenalty: 0.5, frequencyPenalty: 0.3 }
    for (const provider of ['google_vertex', 'google', 'anthropic', 'bedrock']) {
      const p = sidecarParameters(s, provider)
      expect(p).not.toHaveProperty('presence_penalty')
      expect(p).not.toHaveProperty('frequency_penalty')
      expect(p.temperature).toBe(0.85)
    }
  })
  test('omits default top_p and zero penalties everywhere', () => {
    const p = sidecarParameters(settings(), 'openai')
    expect(p).toEqual({ temperature: 0.85, max_tokens: 2048 })
  })
  test('keeps non-default values where supported, plus the model override', () => {
    const p = sidecarParameters({ ...settings(), topP: 0.9, presencePenalty: 0.4, sidecarModelId: 'm' }, 'openai')
    expect(p).toEqual({ model: 'm', temperature: 0.85, max_tokens: 2048, top_p: 0.9, presence_penalty: 0.4 })
  })
})

describe('output language', () => {
  const messages = [{ role: 'system' as const, content: 'SYS' }, { role: 'user' as const, content: 'hi' }]
  test('defaults to Korean and appends the rule to the leading system prompt', () => {
    expect(settings().outputLanguage).toBe('Korean')
    const out = withOutputLanguage(messages, 'Korean')
    expect(out).toHaveLength(2)
    expect(out[0].content).toStartWith('SYS')
    expect(out[0].content).toContain('in Korean')
    expect(out[0].content).toContain('<action>')
    expect(out[1]).toEqual(messages[1])
    expect(messages[0].content).toBe('SYS')
  })
  test('empty language leaves prompts untouched', () => {
    expect(withOutputLanguage(messages, '')).toBe(messages)
    expect(withOutputLanguage(messages, undefined)).toBe(messages)
  })
})
