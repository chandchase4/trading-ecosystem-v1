import 'dotenv/config'
import readline from 'node:readline'
import { execute } from './commands.js'
import { disconnectDatabase } from './db.js'

async function run(input) {
  const result = await execute(input)
  for (const line of result.lines) console.log(line)
  return result.keepRunning
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
} finally {
  await disconnectDatabase()
}
