import { runMarketPriceIngestion } from '../src/lib/scraper'

async function main() {
  const summary = await runMarketPriceIngestion()
  console.log(JSON.stringify(summary, null, 2))
  if (summary.status === 'failed') process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
