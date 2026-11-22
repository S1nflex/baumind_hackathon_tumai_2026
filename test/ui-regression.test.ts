import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/workspace.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/components/position-detail.tsx', import.meta.url), 'utf8')

test('mobile layout keeps page width scoped and replaces the LV table with touch cards', () => {
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.table-scroll \.lv-table\{display:none!important\}/)
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.bm-mobile-position-list\{display:grid/)
  assert.match(css, /\.bm-mobile-position\{[^}]*width:100%;[^}]*min-width:0/)
  assert.match(css, /\.bm-pdf-dialog\{[^}]*width:100vw;[^}]*max-width:100vw/)
  assert.match(workspace, /className="bm-mobile-position-list"/)
  assert.match(workspace, /className="bm-mobile-navigation"/)
})

test('position editor retains compact and fullscreen controls on responsive layouts', () => {
  assert.match(detail, /type InspectorMode = 'compact' \| 'focus'/)
  assert.match(detail, /setMode\(mode === 'focus' \? 'compact' : 'focus'\)/)
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.bm-inspector \.bm-calculation-totals/)
})
