import type { LlmMessageDTO } from 'lumiverse-spindle-types'
import { DEFAULT_GENERATION_MAX_TOKENS, type TimelineSettings } from './shared'

/** Providers whose APIs reject OpenAI-style penalty fields. Lumiverse forwards
 * unknown parameters verbatim for these, so sending them (even as 0) fails. */
const PROVIDERS_WITHOUT_PENALTIES = new Set(['google_vertex', 'google', 'anthropic', 'bedrock'])

export function sidecarParameters(settings: TimelineSettings, provider: string | undefined): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    ...(settings.sidecarModelId ? { model: settings.sidecarModelId } : {}),
    temperature: settings.temperature ?? 0.85,
    max_tokens: settings.maxTokens ?? DEFAULT_GENERATION_MAX_TOKENS,
  }
  // top_p = 1 is the API default; omitting it avoids "temperature and top_p cannot
  // both be set" errors from newer Claude models (including Claude on Vertex).
  const topP = settings.topP ?? 1.0
  if (topP < 1) parameters.top_p = topP
  if (!PROVIDERS_WITHOUT_PENALTIES.has(String(provider || '').toLowerCase())) {
    if (settings.presencePenalty) parameters.presence_penalty = settings.presencePenalty
    if (settings.frequencyPenalty) parameters.frequency_penalty = settings.frequencyPenalty
  }
  return parameters
}

/** Adds the output-language rule to the leading system prompt of every generation. */
export function withOutputLanguage(messages: LlmMessageDTO[], language: string | undefined): LlmMessageDTO[] {
  const target = (language || '').trim()
  if (!target) return messages
  const rule = [
    `OUTPUT LANGUAGE: Write every piece of text a reader will see in ${target}: weaves, replies, direct messages, and display names.`,
    `Use natural, casual ${target} as people really write on social media, matching each character's voice.`,
    'Never translate or alter the output format: keep XML-style tags such as <action>, <target>, <reaction>, <gif>, <display_name>, <handle> exactly as instructed, and keep action keywords (weave, reply, react, dm), post ids and @handles exactly as given. Handles stay lowercase ASCII.',
    'Write the GIF search query inside <gif> in short English keywords so the GIF search works.',
  ].join('\n')
  const index = messages.findIndex((message) => message.role === 'system')
  if (index < 0) return [{ role: 'system', content: rule }, ...messages]
  return messages.map((message, at) => at === index && typeof message.content === 'string'
    ? { ...message, content: `${message.content}\n\n${rule}` }
    : message)
}
