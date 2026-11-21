import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { summarize, unitOf } from './estimate'
import type { Preference, Project, ProjectListItem } from './model'

let connection: DatabaseSync | undefined
function database() {
  if (connection) return connection
  const file = process.env.BAUTON_DB || resolve('.data/bauton.sqlite')
  // Project data is created and managed at runtime.
  const directory = dirname(/* turbopackIgnore: true */ file)
  mkdirSync(directory, { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, original BLOB, revision INTEGER NOT NULL, workspace TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS workspace_preferences (
        workspace TEXT NOT NULL, trade TEXT NOT NULL, title TEXT NOT NULL, rate REAL, uses INTEGER NOT NULL,
        PRIMARY KEY (workspace, trade, title)
      );
    `)
    if (!db.prepare('PRAGMA table_info(projects)').all().some(column => column.name === 'workspace')) {
      db.exec("ALTER TABLE projects ADD COLUMN workspace TEXT NOT NULL DEFAULT ''")
    }
    db.exec('CREATE INDEX IF NOT EXISTS projects_workspace ON projects(workspace)')
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'preferences'").get()) {
      db.exec(`INSERT OR IGNORE INTO workspace_preferences
        SELECT '', trade, title, rate, uses FROM preferences`)
    }
    db.exec('COMMIT')
    connection = db
    return connection
  } catch (error) {
    db.exec('ROLLBACK')
    db.close()
    throw error
  }
}

export class ProjectError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function requireProject(workspace: string, id: string): Project {
  const result = database().prepare('SELECT snapshot FROM projects WHERE workspace = ? AND id = ?').get(workspace, id)
  if (!result) throw new ProjectError('Projekt nicht gefunden.', 404)
  return JSON.parse(result.snapshot as string) as Project
}

export function listProjects(workspace: string): ProjectListItem[] {
  return database().prepare('SELECT snapshot FROM projects WHERE workspace = ? ORDER BY rowid DESC').all(workspace)
    .map(({ snapshot }) => JSON.parse(snapshot as string) as Project)
    .map(p => ({ id: p.id, name: p.name, fileName: p.fileName, format: p.format, createdAt: p.createdAt,
      archivedAt: p.archivedAt, demo: p.demo, count: p.positions.filter(row => row.origin === 'imported').length,
      open: p.findings.filter(finding => finding.status === 'open').length }))
}

export function createProject(workspace: string, project: Project, original?: Buffer) {
  database().prepare('INSERT INTO projects (id, snapshot, original, revision, workspace) VALUES (?, ?, ?, ?, ?)')
    .run(project.id, JSON.stringify(project), original ?? null, project.revision, workspace)
  return project
}

export function originalFile(workspace: string, id: string) {
  const result = database().prepare('SELECT original FROM projects WHERE workspace = ? AND id = ?').get(workspace, id)
  if (!result?.original) throw new ProjectError('Dieses Projekt hat kein hinterlegtes Original.', 404)
  return result.original as Uint8Array<ArrayBuffer>
}

export function getPreferences(workspace: string): Preference[] {
  return database().prepare('SELECT trade, title, rate, uses FROM workspace_preferences WHERE workspace = ? ORDER BY uses DESC').all(workspace) as Preference[]
}

export function updateProject(workspace: string, id: string, revision: number, edit: (project: Project) => void) {
  const db = database()
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = requireProject(workspace, id)
    if (current.revision !== revision) throw new ProjectError('Das Projekt wurde inzwischen geändert. Die aktuelle Fassung wurde geladen.', 409)
    if (current.archivedAt) throw new ProjectError('Dieses Angebot wurde bereits abgeschlossen.', 409)
    edit(current)
    current.revision++
    db.prepare('UPDATE projects SET snapshot = ?, revision = ? WHERE workspace = ? AND id = ?')
      .run(JSON.stringify(current), current.revision, workspace, id)
    db.exec('COMMIT')
    return current
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function finalizeProject(workspace: string, project: Project) {
  const summary = summarize(project)
  if (summary.open || summary.withoutPrice || !project.positions.some(row => row.accepted && row.included)) {
    throw new ProjectError('Bitte offene Prüfpunkte und fehlende Preise bearbeiten, bevor das Angebot abgeschlossen wird.')
  }
  project.archivedAt = new Date().toISOString()
  if (project.demo) return
  const seen = new Set<string>()
  for (const item of project.positions) {
    if (item.category !== 'crew' || !item.trade || !item.accepted || !item.included) continue
    const trade = /^elektro$/i.test(item.trade) ? 'Elektro' : item.trade
    const key = JSON.stringify([trade, item.title])
    if (seen.has(key)) continue
    seen.add(key)
    const hourly = /^(?:h|std\.?|stunden?)$/i.test(unitOf(item)) || item.origin === 'suggested'
    database().prepare('INSERT INTO workspace_preferences (workspace, trade, title, rate, uses) VALUES (?, ?, ?, ?, 1) ON CONFLICT(workspace, trade, title) DO UPDATE SET uses = uses + 1, rate = COALESCE(excluded.rate, rate)')
      .run(workspace, trade, item.title, hourly ? item.costs.rate : null)
  }
}
