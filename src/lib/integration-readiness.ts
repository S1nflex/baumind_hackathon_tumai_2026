/** Server-only, deliberately never includes API key values in its result. */
export type IntegrationReadiness = {
  aiReady: boolean
  marketReady: boolean
  aiProvider: 'openai' | 'anthropic' | null
  marketSources: Array<'supabase' | 'serpapi'>
  missing: Array<'AI' | 'MARKET'>
  readyForFullImport: boolean
}

export function integrationReadiness(env: Partial<NodeJS.ProcessEnv> = process.env): IntegrationReadiness {
  const anthropic = Boolean(env.ANTHROPIC_API_KEY?.trim() && env.ANTHROPIC_MODEL?.trim())
  const openai = Boolean(env.OPENAI_API_KEY?.trim())
  const marketSources: Array<'supabase' | 'serpapi'> = []
  if (env.SUPABASE_URL?.trim() && (env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim())) marketSources.push('supabase')
  if (env.SERPAPI_API_KEY?.trim()) marketSources.push('serpapi')
  const missing: Array<'AI' | 'MARKET'> = []
  if (!openai && !anthropic) missing.push('AI')
  if (!marketSources.length) missing.push('MARKET')
  return { aiReady: anthropic || openai, marketReady: marketSources.length > 0,
    aiProvider: openai ? 'openai' : anthropic ? 'anthropic' : null,
    marketSources, missing, readyForFullImport: missing.length === 0 }
}
