import 'dotenv/config'
import readline from 'node:readline'
import { HELP } from './commands.js'

const port = Number(process.env.PORT) || 3001
const endpoint = `http://127.0.0.1:${port}/api/commands`

// CLI and browser both submit to the same long-running backend, so their
// in-memory scanner states are identical.
async function run(input) {
  const command = input.trim()
  if (!command) return true
  if (command === 'exit' || command === 'quit') return false
  if (command === 'help') {
    console.log(HELP)
    return true
  }

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error('Backend unavailable. Start "npm run dev" in a separate server terminal.')
  }

  const payload = await response.json()
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Command failed.')
  for (const line of payload.lines ?? []) console.log(line)
  return payload.keepRunning !== false
}

async function main() {
  const once = process.argv.slice(2)
  if (once.length) {
    await run(once.join(' '))
    return
  }

  console.log('Trading Ecosystem CLI — type help for commands.')
  const interactive = Boolean(process.stdin.isTTY)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: interactive,
  })
  if (interactive) {
    rl.setPrompt('trade> ')
    rl.prompt()
  }

  for await (const line of rl) {
    try {
      if (!(await run(line))) break
    } catch (error) {
      console.error(`Error: ${error.message}`)
    }
    if (interactive) rl.prompt()
  }
  rl.close()
}

try {
  await main()
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
}
