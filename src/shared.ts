export const TIMELINE_STORAGE_PATH = 'timeline/state.json'
export const MAX_WEAVE_LENGTH = 500
export const MAX_DIRECT_MESSAGE_LENGTH = 1_000
export const MAX_POSTS = 320
export const MAX_DIRECT_THREADS = 80
export const MAX_DIRECT_MESSAGES_PER_THREAD = 120
export const MAX_ROSTER_ACTORS = 30
export const MAX_IDENTITY_BACKFILL_BATCH = 20
export const MAX_CHAT_CONTEXT_MESSAGES = 30
export const DEFAULT_CHAT_CONTEXT_MESSAGES = 10
export const MIN_GENERATION_MAX_TOKENS = 32
export const MAX_GENERATION_MAX_TOKENS = 32_768
export const DEFAULT_GENERATION_MAX_TOKENS = 2_048
export const REACTION_EMOJIS = ['❤', '✨', '🔥', '😂'] as const

let timelineIdSequence = 0

/**
 * Produces a locally unique identifier for timeline records.
 *
 * These IDs are only used to correlate locally stored posts, threads, and
 * messages; they are not credentials or security tokens. The browser's secure
 * context UUID API is unavailable on non-secure HTTP origins, so use the
 * extension's existing non-cryptographic randomness instead.
 */
export function createTimelineId(): string {
  timelineIdSequence = (timelineIdSequence + 1) >>> 0
  return `xtl_${Date.now().toString(36)}_${timelineIdSequence.toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export type TimelineActorKind = 'persona' | 'character' | 'council' | 'lumia'
export type TimelineRosterAction = 'weave' | 'reply' | 'react' | 'dm'
export type TimelineFeedSort = 'newest' | 'activity'

export interface TimelineActor {
  key: string
  kind: TimelineActorKind
  sourceId: string
  name: string
  handle: string
  avatarUrl: string | null
  bio: string
  profile: string
  role?: string
}

export interface TimelineActorIdentity {
  displayName: string
  handle: string
  createdAt: number
}

export interface TimelineReaction {
  emoji: string
  actorKeys: string[]
}

export interface TimelineChatSource {
  kind: 'chat'
  chatId: string
  chatName: string
  characterName: string | null
}

export interface TimelineChatContext {
  messageCount: number
  excerpt: string
}

export interface TimelinePost {
  id: string
  author: TimelineActor
  content: string
  createdAt: number
  replyToId: string | null
  threadRootId: string
  reactions: TimelineReaction[]
  source: 'manual' | 'model' | 'chat_share'
  chatSource?: TimelineChatSource
  chatContext?: TimelineChatContext
  gifUrl?: string
}

export interface TimelineDirectMessage {
  id: string
  author: TimelineActor
  direction: 'incoming' | 'outgoing'
  content: string
  createdAt: number
  gifUrl?: string
}

export interface TimelineDirectThread {
  id: string
  actor: TimelineActor
  messages: TimelineDirectMessage[]
  lastReadAt: number
}

export interface TimelineSettings {
  selectedPersonaId: string | null
  sidecarConnectionId: string | null
  sidecarModelId: string | null
  feedSort: TimelineFeedSort
  minActorWeaveIntervalMinutes: number
  maxActorWeaveIntervalMinutes: number
  gifChance?: number
  highQualityGifs?: boolean
  encourageNsfw?: boolean
  includeChatContext: boolean
  chatContextMessageCount: number
  maxTokens: number
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  /** Language for all generated text (posts, replies, DMs, display names). Empty = model decides. */
  outputLanguage?: string
}

export interface TimelineState {
  version: 8
  posts: TimelinePost[]
  directThreads: TimelineDirectThread[]
  actorIdentities: Record<string, TimelineActorIdentity>
  rosterActorKeys: string[]
  rosterActorQueue: string[]
  rosterLastActorKey: string | null
  rosterActionHistory: TimelineRosterAction[]
  nextRosterWeaveAt: number | null
  settings: TimelineSettings
}

export interface TimelineConnection {
  id: string
  name: string
  provider: string
  model: string
  hasApiKey: boolean
}

export interface TimelineSnapshot {
  state: TimelineState
  personas: TimelineActor[]
  replyActors: TimelineActor[]
  connections: TimelineConnection[]
  activePersonaId: string | null
  permissions: string[]
}

export function createEmptyTimelineState(): TimelineState {
  return {
    version: 8,
    posts: [],
    directThreads: [],
    actorIdentities: {},
    rosterActorKeys: [],
    rosterActorQueue: [],
    rosterLastActorKey: null,
    rosterActionHistory: [],
    nextRosterWeaveAt: null,
    settings: {
      selectedPersonaId: null,
      sidecarConnectionId: null,
      sidecarModelId: null,
      feedSort: 'newest',
      minActorWeaveIntervalMinutes: 30,
      maxActorWeaveIntervalMinutes: 120,
      gifChance: 35,
      highQualityGifs: false,
      encourageNsfw: false,
      includeChatContext: true,
      chatContextMessageCount: DEFAULT_CHAT_CONTEXT_MESSAGES,
      maxTokens: DEFAULT_GENERATION_MAX_TOKENS,
      temperature: 0.85,
      topP: 1.0,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
      outputLanguage: 'Korean',
    },
  }
}
