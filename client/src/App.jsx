import { useEffect, useState } from 'react'
import { createDemoWorkspace } from './demoData.js'

const emptyState = {
  assets: [],
  collections: [],
  scanners: [],
  registry: { uniqueAssets: 0 },
  assetDetails: [], memberships: [], processes: [], providers: [], exchanges: [],
  eventRules: [], market: { quotes: [], connection: 'idle', unsupported: [] },
  automation: { alerts: [], snapshots: [], recentEvents: [], snapshotStorage: { count: 0, totalBytes: 0, maxBytes: 2000000 } },
}

const examples = [
  'asset add BTC, ETH, TSLA',
  'collection create watchlist',
  'collection add watchlist BTC, ETH',
  'scanner create momentum',
  'scanner attach momentum watchlist',
  'scanner status momentum',
  'market list',
  'snapshot take',
  'demo trigger',
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
  const [backendWorkspace, setWorkspace] = useState(emptyState)
  const [demoMode, setDemoMode] = useState(true)
  const [tab, setTab] = useState('overview')
  const [demoPulse, setDemoPulse] = useState(0)
  const [demoAlerts, setDemoAlerts] = useState([])
  const view = demoMode ? createDemoWorkspace(demoPulse, demoAlerts) : backendWorkspace
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

  useEffect(() => {
    if (!demoMode) return undefined
    const timer = window.setInterval(() => setDemoPulse(value => value + 1), 2500)
    return () => window.clearInterval(timer)
  }, [demoMode])

  useEffect(() => {
    if (demoMode) return undefined
    const timer = window.setInterval(() => {
      api('state').then(data => { setWorkspace(data.state); setOnline(true) })
        .catch(() => setOnline(false))
    }, 3500)
    return () => window.clearInterval(timer)
  }, [demoMode])

  function simulateDemo() {
    const now = new Date().toLocaleTimeString()
    setDemoAlerts(previous => [{
      id: 'sim-' + Date.now(), message: 'BTC +5% → snapshot captured → alert recorded',
      symbol: 'BTC', event: 'market.momentum.detected', snapshotId: 'simulated-snapshot',
      at: now, demo: true,
    }, ...previous].slice(0, 6))
    setMessage('SIMULATED event executed: matching rule → snapshot.capture → alert.record. No provider or database used.')
  }

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
    if (!view.collections.some(item => item.name === selectedList)) {
      setSelectedList(view.collections[0]?.name || '')
    }
  }, [view.collections, selectedList])

  async function runCommand(command, afterSuccess, allowDemo = false) {
    if (busy || !command.trim()) return
    if (demoMode && !allowDemo) {
      setMessage('Demo preview is read-only. Switch to Backend or click “Seed backend” to run real commands.')
      return
    }
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

  const activeList = view.collections.find(item => item.name === selectedList)
  const quotes = view.market?.quotes || []
  const alertCount = view.automation?.alerts?.length || 0
  const formatPrice = value => Number(value).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: Number(value) < 1 ? 5 : 2,
  })

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">TE</span>
          <div>
            <strong>Trading Ecosystem</strong>
            <small>Market intelligence · v1 / foundation</small>
          </div>
        </div>
        <span className={online ? 'connection online' : 'connection offline'}>
          <span className="dot" /> {online ? 'Backend connected' : 'Backend offline'}
        </span>
      </header>

      <div className="intro">
        <div>
          <p className="eyebrow">TRADING ECOSYSTEM / CONTROL CENTER</p>
          <h1>See the market. Control the system.</h1>
          <p className="muted">Assets, live feeds, scanners and event automation — one shared workspace.</p>
        </div>
        <button className="quiet" disabled={busy} onClick={() => refresh().then(() => setMessage('Backend refreshed.')).catch(error => { setOnline(false); setMessage(error.message) })}>↻ Refresh</button>
      </div>
      <div className={demoMode ? 'mode-banner demo-mode' : 'mode-banner'}>
        <div><strong>{demoMode ? '◈ SHOWCASE MODE — SIMULATED DATA' : '● BACKEND MODE — REAL STATE'}</strong>
          <p>{demoMode ? 'Illustrative prices, rules and snapshots. No demo figures are market quotes.' : 'Actual MongoDB records and connected feeds. Missing stock feeds stay blank; nothing is invented.'}</p>
        </div>
        <div className="mode-actions">
          <button className={demoMode ? 'active-mode' : 'quiet'} onClick={() => { setDemoMode(true); setTab('overview') }}>Preview demo</button>
          <button className={!demoMode ? 'active-mode' : 'quiet'} onClick={() => { setDemoMode(false); setTab('overview') }}>Backend</button>
        </div>
      </div>
      <nav className="tab-nav" aria-label="Workspace sections">
        {[
          ['overview', '◈ Overview'], ['assets', '◇ Asset registry'],
          ['automation', '⚡ Events & snapshots'], ['workspace', '▤ Lists & scanners'],
        ].map(([key,label]) => <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      <div className="stats">
        <div><small>CATALOG</small><strong>{view.assets.length}</strong><span>Registered assets</span></div>
        <div><small>FEED</small><strong className={quotes.length ? 'highlight' : ''}>{quotes.length}</strong><span>{demoMode ? 'Simulated price streams' : 'Live market quotes'}</span></div>
        <div><small>RUNTIME</small><strong>{view.scanners.filter(item => item.running).length}<i> / {view.scanners.length}</i></strong><span>Active scanners</span></div>
        <div><small>AUTOMATION</small><strong>{view.eventRules.filter(rule => rule.enabled).length}</strong><span>Enabled event rules</span></div>
      </div>

      {message && <div role="status" className="notice">{message}</div>}

      {tab === 'overview' && (
        <div className="dashboard-grid">
          <section className="panel market-panel">
            <div className="panel-title"><span className="section-number">01</span><div>
              <h2>Market stream</h2>
              <p>{demoMode ? 'Animated sample prices — not live or tradeable' : 'Real Coinbase ticker feed when a crypto scanner is running'}</p>
            </div><span className={demoMode ? 'feed-indicator simulated' : 'feed-indicator'}>{demoMode ? 'SIMULATED' : view.market?.connection?.toUpperCase()}</span></div>
            <div className="table-scroll"><table className="market-table"><thead><tr><th>Asset</th><th>Last price</th><th>Window Δ</th><th>Source / market</th></tr></thead>
            <tbody>{quotes.map(quote => <tr key={quote.symbol}>
              <td><strong>{quote.symbol}</strong><small>{view.assetDetails.find(a => a.symbol === quote.symbol)?.name || quote.marketSymbol}</small></td>
              <td className="price-cell">{formatPrice(quote.price)}</td>
              <td><span className={quote.changeWindowPct >= 0 ? 'change positive' : 'change negative'}>{quote.changeWindowPct >= 0 ? '+' : ''}{Number(quote.changeWindowPct).toFixed(2)}%</span></td>
              <td className="source-cell">{quote.provider}<small>{quote.marketSymbol}</small></td>
            </tr>)}</tbody></table>
            {!quotes.length && <div className="empty-state">No live quotes yet. Start a scanner containing BTC or ETH to connect to Coinbase. Stocks require a separate authenticated provider.</div>}</div>
            <div className="table-foot"><span>{view.market?.observationCount || 0} temporary price observations</span><span>5-minute rolling buffer · no price history writes</span></div>
          </section>
          <div className="side-stack">
            <section className="panel">
              <div className="panel-title"><span className="section-number">02</span><div><h2>Process engine</h2><p>One runtime, specialized workloads.</p></div></div>
              <div className="process-list">
                {view.processes.map(process => <div className="process-row" key={process.name}>
                  <span className={'process-glyph ' + process.kind}>{process.kind === 'scanner' ? '↗' : process.kind === 'discovery' ? '◎' : '▣'}</span>
                  <div><strong>{process.name}</strong><small>{process.kind}{process.intervalSeconds ? ' · ' + process.intervalSeconds + 's interval' : ''}</small></div>
                  <span className={process.kind === 'scanner' && view.scanners.some(s => s.name === process.name && s.running) ? 'pill live' : 'pill'}>{process.kind === 'scanner' && view.scanners.some(s => s.name === process.name && s.running) ? 'Running' : 'Idle'}</span>
                </div>)}
                {!view.processes.length && <div className="empty-state">No processes. Create a scanner in Lists & scanners.</div>}
              </div>
            </section>
            <section className="panel subtle-panel"><h2>Architecture health</h2>
              <div className="health-row"><span>Asset registry</span><b>MongoDB</b></div>
              <div className="health-row"><span>Market window</span><b>RAM · bounded</b></div>
              <div className="health-row"><span>Snapshot persistence</span><b>OFF by default</b></div>
              <div className="health-row"><span>Equities provider</span><b>Not configured</b></div>
            </section>
          </div>
        </div>
      )}
      {tab === 'assets' && (
        <section className="panel">
          <div className="panel-title"><span className="section-number">01</span><div><h2>Canonical asset registry</h2><p>One identity per asset. Every provider/exchange market stays separate; memberships hold contextual overrides.</p></div></div>
          <div className="asset-grid">
            {view.assetDetails.map(asset => <article className="asset-card" key={asset.symbol}>
              <div className="asset-card-head"><span className="asset-monogram">{asset.symbol.slice(0,2)}</span><div><strong>{asset.symbol} <span className="asset-name">{asset.name}</span></strong><small>{asset.assetClass}</small></div></div>
              <div className="mini-label">KNOWN MARKETS · EXAMPLES / CONFIGURATION</div>
              {asset.markets?.length ? asset.markets.map((market,index) => <div className="market-option" key={market.provider+market.symbol+index}>
                <span>{market.symbol} <small>#{market.activityRank || index+1}</small></span>
                <span>{market.provider} / {market.exchange}</span>
              </div>) : <span className="empty">No markets registered yet.</span>}
              <div className="asset-foot"><span>{view.memberships.filter(m => m.asset === asset.symbol).length} memberships</span><span>Registry / persistent</span></div>
            </article>)}
            {!view.assetDetails.length && <div className="empty-state">No assets. Add symbols via Lists & scanners or use “Seed backend” for sample records.</div>}
          </div>
          <div className="directory-row"><div><h3>Providers</h3>{view.providers.map(provider => <span className="directory-chip" key={provider.slug}>{provider.name} <small>{provider.capabilities?.join(' · ')}</small></span>)}</div>
          <div><h3>Exchanges</h3>{view.exchanges.map(exchange => <span className="directory-chip" key={exchange.slug}>{exchange.name}</span>)}</div></div>
        </section>
      )}
      {tab === 'automation' && (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-title"><span className="section-number">01</span><div><h2>Event rules</h2><p>Trigger → conditions → ordered actions. Disabled by default unless explicitly enabled.</p></div></div>
            {view.eventRules.map(rule => <article className="rule-card" key={rule.name}>
              <div className="rule-heading"><strong>{rule.name}</strong><span className={rule.enabled ? 'pill live' : 'pill'}>{rule.enabled ? 'Enabled' : 'Disabled'}</span></div>
              <code className="event-trigger">{rule.trigger}</code>
              <div className="rule-flow"><span>{rule.conditions?.length || 0} conditions</span><b>→</b>{rule.actions?.map((action,index) => <span key={index}>{action.type}</span>)}</div>
              <small className="muted">Scope: {rule.target?.scope || 'global'}{rule.target?.id ? ' / '+rule.target.id : ''}</small>
            </article>)}
            {!view.eventRules.length && <div className="empty-state">No rules saved yet. Seed the backend to try an example BTC threshold rule.</div>}
            <div className="action-row">
              {demoMode ? <button onClick={simulateDemo}>⚡ Simulate BTC +5% event</button>
                : <button onClick={() => runCommand('demo trigger')} disabled={busy}>⚡ Trigger test BTC +5%</button>}
              {demoMode
                ? <button className="secondary" onClick={() => runCommand('demo seed', () => { setDemoMode(false); setTab('automation') }, true)} disabled={busy || !online}>Seed backend with demo records</button>
                : <button className="secondary" onClick={() => runCommand('snapshot take')} disabled={busy}>▣ Take RAM snapshot</button>}
            </div>
          </section>
          <div className="side-stack">
            <section className="panel">
              <div className="panel-title"><span className="section-number">02</span><div><h2>Snapshots</h2><p>Reusable data envelopes · space-bounded RAM</p></div></div>
              <div className="storage-meter"><div style={{width: Math.min(100, 100 * (view.automation?.snapshotStorage?.totalBytes || 0) / (view.automation?.snapshotStorage?.maxBytes || 2000000)) + '%'}} /></div>
              <div className="tiny">{(view.automation?.snapshotStorage?.totalBytes || 0).toLocaleString()} / {(view.automation?.snapshotStorage?.maxBytes || 2000000).toLocaleString()} bytes</div>
              {(view.automation?.snapshots || []).map(snapshot => <div className="event-row" key={snapshot.id}>
                <strong>▣ {snapshot.type}</strong><small>{snapshot.capturedAt} · {snapshot.bytes} B</small>
              </div>)}
              {!view.automation?.snapshots?.length && <div className="empty-state">No snapshots yet. Recording is off until you request a capture.</div>}
            </section>
            <section className="panel">
              <div className="panel-title"><span className="section-number">03</span><div><h2>Alert & event activity</h2><p>{alertCount} alerts in the current runtime</p></div></div>
              {(view.automation?.alerts || []).slice(0,6).map(alert => <div className="event-row" key={alert.id}>
                <strong>⚡ {alert.message}</strong><small>{alert.at} {alert.demo ? '· demo' : ''}</small>
              </div>)}
              {!alertCount && <div className="empty-state">No alerts. The test event above can demonstrate the event pipeline.</div>}
            </section>
          </div>
        </div>
      )}
      {tab === 'workspace' && <div className="workspace-body">
      {demoMode && <div className="notice">Showcase is read-only. Switch to Backend to edit MongoDB collections and scanners.</div>}
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
          <select id="list-select" value={selectedList} onChange={event => setSelectedList(event.target.value)} disabled={!view.collections.length}>
            {view.collections.length === 0 && <option value="">Create a list first</option>}
            {view.collections.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
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
            {view.scanners.length === 0 && <div className="empty large">No scanners yet. Create one above.</div>}
            {view.scanners.map(scanner => (
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
                    {view.collections.filter(item => !scanner.collections.includes(item.name)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
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
      </div>}
      <footer>Trading Ecosystem V1 · {demoMode ? 'Sample data preview — not real prices' : 'Real backend state'} · No trading or order execution</footer>
    </div>
  )
}
