import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export type AiProviderName = 'anthropic' | 'openai'
type Purpose = 'assistant' | 'review'

/** Server-only provider selection. No key is ever exposed to a client bundle. */
export function configuredAiModel(purpose: Purpose) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  const anthropicModel = process.env.ANTHROPIC_MODEL?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const openaiModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'

  // Use the same primary provider for pricing and chat. A stale Anthropic
  // setting must not silently hijack a healthy OpenAI assistant.
  const explicit = process.env.BAUMIND_AI_PROVIDER?.trim().toLowerCase()
  const order: AiProviderName[] = explicit === 'anthropic'
    ? ['anthropic', 'openai'] : ['openai', 'anthropic']

  for (const provider of order) {
    if (provider === 'anthropic' && anthropicKey && anthropicModel) {
      return {
        provider,
        model: createAnthropic({ apiKey: anthropicKey })(anthropicModel),
      }
    }
    if (provider === 'openai' && openaiKey) {
      return {
        provider,
        model: createOpenAI({ apiKey: openaiKey, baseURL: 'https://api.openai.com/v1' }).responses(openaiModel),
        providerOptions: { openai: { store: false, ...(openaiModel === 'gpt-5-mini' ? { reasoningEffort: 'low' as const } : {}) } },
      }
    }
  }
  return null
}
