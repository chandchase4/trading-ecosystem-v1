const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9._:/-]{0,31}$/
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/

export function normalizeSymbol(value) {
  const symbol = String(value ?? '').trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error('Invalid symbol. Use up to 32 letters/numbers and . _ : / -')
  }
  return symbol
}

export function normalizeName(value) {
  const name = String(value ?? '').trim().toLowerCase()
  if (!NAME_PATTERN.test(name)) {
    throw new Error('Invalid collection name. Use up to 40 lowercase letters, numbers, - or _')
  }
  return name
}
