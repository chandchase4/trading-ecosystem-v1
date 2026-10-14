import { useEffect, useState } from 'react'

const emptyState = {
  assets: [],
  collections: [],
  scanners: [],
  registry: { uniqueAssets: 0 },
}

const examples = [
  'asset add BTC, ETH, TSLA',
  'collection create watchlist',
  'collection add watchlist BTC, ETH',
  'scanner create momentum',
  'scanner attach momentum watchlist',
  'scanner status momentum',
]

async function api(path, options) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Backend not reachable. Open the Codespaces port 5173 preview, with the server running on port 3001. GitHub Pages cannot run the Node backend.')
  }
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export default function App() {
  const [workspace, setWorkspace] = useState(emptyState)
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState([])
  const [selectedList, setSelectedList] = useState('')
  const [newList, setNewList] = useState('')
  const [symbols, setSymbols] = useState('')
  const [newScanner, setNewScanner] = useState('')
  const [attachChoice, setAttachChoice] = useState({})
  const [consoleInput, setConsoleInput] = useState('')

  async function refresh() {
    const data = await api('state')
    setWorkspace(data.state)
    setOnline(true)
    return data.state
  }

  useEffect(() => {
    let cancelled = false
    api('state')
      .then(data => {
        if (!cancelled) {
          setWorkspace(data.state)
          setOnline(true)
        }
      })
      .catch(error => {
        if (!cancelled) {
          setOnline(false)
          setMessage(error.message)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!workspace.collections.some(item => item.name === selectedList)) {
      setSelectedList(workspace.collections[0]?.name || '')
    }
  }, [workspace.collections, selectedList])

  async function runCommand(command, afterSuccess) {
    if (busy || !command.trim()) return
    setBusy(true)
    setMessage('')
    try {
      const response = await api('commands', {
        method: 'POST',
        body: JSON.stringify({ command }),
      })
      const output = response.lines?.join('\n') || 'Command completed.'
      setHistory(previous => [{ command, output, error: false }, ...previous].slice(0, 10))
      const next = await refresh()
      setMessage(output)
      afterSuccess?.(next)
    } catch (error) {
      setHistory(previous => [{ command, output: error.message, error: true }, ...previous].slice(0, 10))
      setMessage(error.message)
      if (error.message.includes('Backend')) setOnline(false)
    } finally {
      setBusy(false)
    }
  }

  function confirmCommand(question, command) {
    if (window.confirm(question)) runCommand(command)
  }

  function rename(kind, current) {
    const value = window.prompt(`Rename ${kind} "${current}" to:`, current)
    if (value && value.trim() !== current) runCommand(`${kind} rename ${current} ${value.trim()}`)
  }

  const activeList = workspace.collections.find(item => item.name === selectedList)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">TE</span>
          <div>
            <strong>Trading Ecosystem</strong>
            <small>Configuration workspace · v1</small>
          </div>
        </div>
        <span className={online ? 'connection online' : 'connection offline'}>
          <span className="dot" /> {online ? 'Backend connected' : 'Backend offline'}
        </span>
      </header>

      <div className="intro">
        <div>
          <p className="eyebrow">Foundation testing</p>
          <h1>Manage lists & scanners</h1>
          <p className="muted">Save symbols, organize watchlists, and control scanner configurations. Nothing here places trades or fetches market prices.</p>
        </div>
        <button className="quiet" disabled={busy} onClick={() => refresh().then(() => setMessage('Workspace refreshed.')).catch(error => { setOnline(false); setMessage(error.message) })}>↻ Refresh</button>
      </div>

      <div className="stats">
        <div><strong>{workspace.assets.length}</strong><span>Saved assets</span></div>
        <div><strong>{workspace.collections.length}</strong><span>Lists</span></div>
        <div><strong>{workspace.scanners.length}</strong><span>Scanners</span></div>
        <div><strong>{workspace.registry?.uniqueAssets || 0}</strong><span>Registry assets</span></div>
      </div>

      {message && <div role="status" className="notice">{message}</div>}

      <div className="columns">
        <section className="panel" aria-label="Lists">
          <div className="panel-title">
            <span className="section-number">01</span>
            <div>
              <h2>Lists</h2>
              <p>Create a watchlist and add tickers in one paste.</p>
            </div>
          </div>

          <form className="form-inline" onSubmit={event => {
            event.preventDefault()
            if (newList.trim()) runCommand(`collection create ${newList.trim()}`, () => {
              setSelectedList(newList.trim().toLowerCase())
              setNewList('')
            })
          }}>
            <label className="sr-only" htmlFor="list-name">New list name</label>
            <input id="list-name" value={newList} onChange={event => setNewList(event.target.value)} placeholder="New list name" maxLength="40" />
            <button disabled={busy || !newList.trim()} type="submit">Create</button>
          </form>

          <div className="separator" />
          <div className="section-heading">
            <label htmlFor="list-select">Selected list</label>
            <span className="tiny">{activeList?.symbols.length || 0} items</span>
          </div>
          <select id="list-select" value={selectedList} onChange={event => setSelectedList(event.target.value)} disabled={!workspace.collections.length}>
            {workspace.collections.length === 0 && <option value="">Create a list first</option>}
            {workspace.collections.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>

          {activeList && (
            <>
              <form className="ticker-form" onSubmit={event => {
                event.preventDefault()
                if (symbols.trim()) runCommand(`collection add ${activeList.name} ${symbols}`, () => setSymbols(''))
              }}>
                <label htmlFor="ticker-input">Add symbols</label>
                <textarea id="ticker-input" rows="2" value={symbols} onChange={event => setSymbols(event.target.value)} placeholder="BTC, TSLA, NVDA, ETH" />
                <p className="hint">Separate with commas, spaces, or line breaks. Existing symbols are reused.</p>
                <button disabled={busy || !symbols.trim()} type="submit">+ Add to {activeList.name}</button>
              </form>

              <div className="section-heading symbol-header">
                <strong>Items</strong>
                <span className="tiny">Tap × to remove</span>
              </div>
              <div className="chips">
                {activeList.symbols.length
                  ? activeList.symbols.map(symbol => (
                    <span className="chip" key={symbol}>{symbol}<button title={`Remove ${symbol}`} aria-label={`Remove ${symbol}`} disabled={busy} onClick={() => runCommand(`collection remove ${activeList.name} ${symbol}`)}>×</button></span>
                  ))
                  : <p className="empty">No tickers yet. Add a few above.</p>}
              </div>
              <div className="row-actions">
                <button className="text-button" disabled={busy} onClick={() => rename('collection', activeList.name)}>Rename list</button>
                <button className="text-button danger" disabled={busy} onClick={() => confirmCommand(`Delete "${activeList.name}" and remove its scanner attachments? Assets will be kept.`, `collection delete ${activeList.name}`)}>Delete list</button>
              </div>
            </>
          )}
        </section>

        <section className="panel" aria-label="Scanners">
          <div className="panel-title">
            <span className="section-number">02</span>
            <div>
              <h2>Scanners</h2>
              <p>Manual scanner CRUD. No live market feeds yet.</p>
            </div>
          </div>
          <form className="form-inline" onSubmit={event => {
            event.preventDefault()
            if (newScanner.trim()) runCommand(`scanner create ${newScanner.trim()}`, () => setNewScanner(''))
          }}>
            <label className="sr-only" htmlFor="scanner-name">New scanner name</label>
            <input id="scanner-name" value={newScanner} onChange={event => setNewScanner(event.target.value)} placeholder="e.g. momentum" maxLength="40" />
            <button disabled={busy || !newScanner.trim()} type="submit">Create</button>
          </form>

          <div className="scanner-list">
            {workspace.scanners.length === 0 && <div className="empty large">No scanners yet. Create one above.</div>}
            {workspace.scanners.map(scanner => (
              <article className="scanner-card" key={scanner.name}>
                <div className="scanner-title">
                  <strong>{scanner.name}</strong>
                  <span className={scanner.running ? 'pill live' : 'pill'}>{scanner.running ? 'Registry active' : 'Stopped'}</span>
                </div>
                <div className="tiny">{scanner.symbols.length} active symbol{scanner.symbols.length === 1 ? '' : 's'} · {scanner.collections.length} attached list{scanner.collections.length === 1 ? '' : 's'}</div>
                <div className="attachments">
                  {scanner.collections.length
                    ? scanner.collections.map(name => (
                      <span className="chip" key={name}>{name}<button title={`Detach ${name}`} aria-label={`Detach ${name} from ${scanner.name}`} disabled={busy} onClick={() => runCommand(`scanner detach ${scanner.name} ${name}`)}>×</button></span>
                    ))
                    : <span className="empty">No lists attached</span>}
                </div>
                <div className="form-inline attach-row">
                  <select aria-label={`Attach a list to ${scanner.name}`} value={attachChoice[scanner.name] || ''} onChange={event => setAttachChoice(current => ({ ...current, [scanner.name]: event.target.value }))}>
                    <option value="">Choose a list</option>
                    {workspace.collections.filter(item => !scanner.collections.includes(item.name)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <button className="secondary" disabled={busy || !attachChoice[scanner.name]} onClick={() => runCommand(`scanner attach ${scanner.name} ${attachChoice[scanner.name]}`, () => setAttachChoice(current => ({ ...current, [scanner.name]: '' })))}>Attach</button>
                </div>

                <div className="scanner-buttons">
                  <button className="secondary" disabled={busy || (!scanner.running && !scanner.collections.length)} onClick={() => runCommand(scanner.running ? `scanner stop ${scanner.name}` : `scanner start ${scanner.name}`)}>{scanner.running ? '■ Stop' : '▶ Start'}</button>
                  <button className="quiet" disabled={busy || !scanner.running} onClick={() => runCommand(`scanner sync ${scanner.name}`)}>↻ Sync</button>
                  <button className="quiet" disabled={busy} onClick={() => runCommand(`scanner status ${scanner.name}`)}>Status</button>
                </div>
                <div className="row-actions">
                  <button className="text-button" disabled={busy} onClick={() => rename('scanner', scanner.name)}>Rename</button>
                  <button className="text-button danger" disabled={busy} onClick={() => confirmCommand(`Delete scanner "${scanner.name}" and its attachments?`, `scanner delete ${scanner.name}`)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel console-panel" aria-label="Command console">
        <div className="panel-title">
          <span className="section-number">03</span>
          <div>
            <h2>Command console</h2>
            <p>Same commands as the terminal, same backend and scanner state.</p>
          </div>
        </div>
        <form className="form-inline" onSubmit={event => {
          event.preventDefault()
          if (consoleInput.trim()) runCommand(consoleInput, () => setConsoleInput(''))
        }}>
          <label className="sr-only" htmlFor="console-input">Command</label>
          <input id="console-input" className="monospace" value={consoleInput} onChange={event => setConsoleInput(event.target.value)} placeholder="collection add watchlist BTC, TSLA" />
          <button type="submit" disabled={busy || !consoleInput.trim()}>Run</button>
        </form>
        <div className="examples">
          {examples.map(example => <button key={example} className="example" onClick={() => setConsoleInput(example)}>{example}</button>)}
        </div>
        <div className="history" aria-live="polite">
          {history.length === 0 && <span className="empty">Commands and responses will appear here.</span>}
          {history.map((item, index) => (
            <div className="history-item" key={index}>
              <div className="prompt-line">› {item.command}</div>
              <pre className={item.error ? 'error' : ''}>{item.output}</pre>
            </div>
          ))}
        </div>
      </section>
      <footer>Local configuration only · MongoDB + Mongoose · No market data · No trading</footer>
    </div>
  )
}
