import { beforeEach, expect, test } from 'bun:test'
import { createEmptyTimelineState, type TimelineState } from '../src/shared'

const userId = 'timeline-user'
const connectionRows = [
  { id: 'first', name: 'First connection', provider: 'openai', model: 'default-first', has_api_key: true },
  { id: 'second', name: 'Second connection', provider: 'anthropic', model: 'default-second', has_api_key: true },
]
const offeredModels = [{ id: 'fast-model', label: 'Fast Model' }]
let state: TimelineState
let generationAllowed = true
let messages: Array<{ payload: any; userId: string }> = []
let generations: any[] = []
let modelRequests: string[][] = []
let receive: (payload: unknown, userId: string) => Promise<void>
const getModels = async (connectionId: string, ownerId: string) => {
  modelRequests.push([connectionId, ownerId])
  return offeredModels
}
const api = {
  permissions: { has: (permission: string) => permission === 'generation' && generationAllowed, onChanged() {} },
  log: { info() {}, warn() {} },
  on() {},
  onFrontendMessage(callback: typeof receive) { receive = callback },
  sendToFrontend(payload: unknown, ownerId: string) { messages.push({ payload, userId: ownerId }) },
  userStorage: {
    async getJson(_file: string, options: { userId: string }) {
      expect(options.userId).toBe(userId)
      return structuredClone(state)
    },
    async setJson(_file: string, next: TimelineState, options: { userId: string }) {
      expect(options.userId).toBe(userId)
      state = structuredClone(next)
    },
  },
  connections: { async list() { return connectionRows }, getModels: getModels as typeof getModels | undefined },
  council: { async getMembers() { return [] } },
  dlc: {
    async getCatalog() {
      return { lumiaItems: [{ id: 'actor', name: 'Actor', definition: '', personality: '', behavior: '', avatar_url: null }] }
    },
  },
  generate: {
    async quiet(input: unknown) {
      generations.push(input)
      return { content: 'A timeline weave.', finish_reason: 'stop' }
    },
  },
}
;(globalThis as any).spindle = api
await import('../src/backend')

beforeEach(() => {
  state = createEmptyTimelineState()
  state.settings.sidecarConnectionId = 'first'
  state.actorIdentities['lumia:actor'] = { displayName: 'Actor', handle: 'actor', createdAt: 1 }
  generationAllowed = true
  api.connections.getModels = getModels
  messages = []
  generations = []
  modelRequests = []
})

test('loads models with the requesting user and preserves labels and request identity', async () => {
  await receive({ type: 'load_connection_models', connectionId: 'first', requestId: 'request-1' }, userId)
  expect(modelRequests).toEqual([['first', userId]])
  expect(messages).toEqual([{
    userId,
    payload: { type: 'timeline_connection_models', connectionId: 'first', requestId: 'request-1', models: offeredModels, supported: true, message: '' },
  }])
})

test('older hosts return an inline manual-entry fallback', async () => {
  api.connections.getModels = undefined
  await receive({ type: 'load_connection_models', connectionId: 'first', requestId: 'old-host' }, userId)
  expect(messages).toHaveLength(1)
  expect(messages[0].payload.supported).toBe(false)
  expect(messages[0].payload.models).toEqual([])
  expect(messages[0].payload.message).toContain('enter a model ID')
})

test('provider failures stay scoped to the model list', async () => {
  api.connections.getModels = async () => { throw new Error('Provider unavailable') }
  await receive({ type: 'load_connection_models', connectionId: 'first', requestId: 'failed' }, userId)
  expect(messages).toHaveLength(1)
  expect(messages[0].payload.type).toBe('timeline_connection_models')
  expect(messages[0].payload.message).toContain('Provider unavailable')
})

test('model listing requires generation permission', async () => {
  generationAllowed = false
  await receive({ type: 'load_connection_models', connectionId: 'first', requestId: 'denied' }, userId)
  expect(modelRequests).toEqual([])
  expect(messages[0].payload.message).toContain('permission')
})

test('saves a trimmed model override and uses it for generation', async () => {
  await receive({ type: 'update_settings', sidecarModelConnectionId: 'first', sidecarModelId: ' fast-model ' }, userId)
  expect(state.settings.sidecarModelId).toBe('fast-model')
  await receive({ type: 'create_actor_weave', actorKey: 'lumia:actor' }, userId)
  expect(generations).toHaveLength(1)
  expect(generations[0].connection_id).toBe('first')
  expect(generations[0].parameters.model).toBe('fast-model')
  expect(state.posts[0].content).toBe('A timeline weave.')
})

test('clearing the override restores connection defaults', async () => {
  state.settings.sidecarModelId = 'fast-model'
  await receive({ type: 'update_settings', sidecarModelConnectionId: 'first', sidecarModelId: null }, userId)
  await receive({ type: 'create_actor_weave', actorKey: 'lumia:actor' }, userId)
  expect(state.settings.sidecarModelId).toBeNull()
  expect(generations[0].parameters).not.toHaveProperty('model')
})

test('switching or clearing connections discards the previous model override', async () => {
  state.settings.sidecarModelId = 'fast-model'
  await receive({ type: 'update_settings', sidecarConnectionId: 'second' }, userId)
  expect(state.settings.sidecarConnectionId).toBe('second')
  expect(state.settings.sidecarModelId).toBeNull()
  state.settings.sidecarModelId = 'second-model'
  await receive({ type: 'update_settings', sidecarConnectionId: null }, userId)
  expect(state.settings.sidecarModelId).toBeNull()
})

test('a stale model edit cannot affect a different connection', async () => {
  await receive({ type: 'update_settings', sidecarConnectionId: 'second' }, userId)
  await receive({ type: 'update_settings', sidecarModelConnectionId: 'first', sidecarModelId: 'fast-model' }, userId)
  expect(state.settings.sidecarConnectionId).toBe('second')
  expect(state.settings.sidecarModelId).toBeNull()
  expect(messages.at(-1)?.payload.type).toBe('timeline_error')
})

test('old saved settings without a model override keep using connection defaults', async () => {
  delete (state.settings as Partial<typeof state.settings>).sidecarModelId
  await receive({ type: 'create_actor_weave', actorKey: 'lumia:actor' }, userId)
  expect(state.settings.sidecarModelId).toBeNull()
  expect(generations[0].parameters).not.toHaveProperty('model')
})
