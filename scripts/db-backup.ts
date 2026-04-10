/**
 * Full Postgres backup via `pg_dump` (custom `-Fc` format).
 * Requires `pg_dump` on PATH and `DATABASE_URL`.
 */
import 'dotenv/config'
import { execFile } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function main() {
  const url = process.env.DATABASE_URL
  if (!url?.trim()) {
    console.error('DATABASE_URL is required.')
    process.exit(1)
  }

  const outDir = process.env.DB_BACKUP_DIR?.trim() || 'backups'
  await mkdir(outDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outFile = join(outDir, `at-store-${stamp}.dump`)

  await execFileAsync('pg_dump', ['-Fc', '-f', outFile, url], {
    stdio: 'inherit',
  })

  const st = await stat(outFile)
  if (st.size < 1) {
    console.error('Backup file is empty.')
    process.exit(1)
  }

  console.log(`Backup written: ${outFile}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
