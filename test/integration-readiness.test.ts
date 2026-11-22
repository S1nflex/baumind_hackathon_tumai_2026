import test from 'node:test'
import assert from 'node:assert/strict'
import { integrationReadiness } from '../src/lib/integration-readiness'

test('full import fails closed with no integration tokens', () => {
  const result = integrationReadiness({})
  assert.equal(result.readyForFullImport,false)
  assert.deepEqual(result.missing,['AI','MARKET'])
})
test('AI key only is not enough for full market research', () => {
  const result = integrationReadiness({OPENAI_API_KEY:'test-key'})
  assert.equal(result.readyForFullImport,false)
  assert.deepEqual(result.missing,['MARKET'])
})
test('SerpAPI and configured OpenAI permit startup without Supabase', () => {
  const result = integrationReadiness({OPENAI_API_KEY:'test-key',SERPAPI_API_KEY:'test-serp'})
  assert.equal(result.readyForFullImport,true)
  assert.deepEqual(result.marketSources,['serpapi'])
})
test('Supabase and configured Anthropic permit startup without SerpAPI', () => {
  const result = integrationReadiness({ANTHROPIC_API_KEY:'test-key',ANTHROPIC_MODEL:'test-model',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'test-secret'})
  assert.equal(result.readyForFullImport,true)
  assert.equal(result.aiProvider,'anthropic')
  assert.deepEqual(result.marketSources,['supabase'])
})
test('Anthropic without model is not ready', () => {
  assert.equal(integrationReadiness({ANTHROPIC_API_KEY:'test-key',SERPAPI_API_KEY:'test-serp'}).readyForFullImport,false)
})
