import { useEffect, useState } from 'react'
import './App.css'

const sections = [
  ['registry', 'Asset Registry', '◈'], ['asset', 'Asset', '◇'], ['collections', 'Collections', '▦'],
  ['processes', 'Processes', '⚙'], ['subscriptions', 'Subscriptions', '↔'],
  ['events', 'Events', '⌁'], ['data', 'Data Manager', '◉'],
]
const empty = { assets: [], collections: [], processes: [], subscriptions: [], rules: [],
  scanner: { running: [], uniqueSymbols: 0 }, events: { recent: [], alerts: [] },
  dataManager: { websocket: 'offline', quotes: [], supportedSymbols: [], activeSymbols: [], unsupported: [] } }
const short = id => String(id || '').slice(-7)
const stamp = date => date ? new Date(date).toLocaleTimeString() : '—'

async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`)
  return result
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function Empty({ children }) { return <div className="empty">{children}</div> }
function Badge({ good, children }) { return <span className={'badge ' + (good ? 'positive' : '')}>{children}</span> }
function Section({ eyebrow, title, description, children }) {
  return <><div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>{children}</>
}

function App() {
  const [tab, setTab] = useState('registry')
  const [state, setState] = useState(empty)
  const [online, setOnline] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [assetSymbol, setAssetSymbol] = useState('')
  const [newAsset, setNewAsset] = useState({ symbol: '', name: '', assetClass: 'crypto' })
  const [newCollection, setNewCollection] = useState('')
  const [addAsset, setAddAsset] = useState({})
  const [newProcess, setNewProcess] = useState({ name: '', kind: 'scanner', minChangePct: '5' })
  const [newSub, setNewSub] = useState({ processId: '', collectionId: '' })
  const [newRule, setNewRule] = useState({ name: '', trigger: 'market.data.received',
    symbol: '', action: 'alert.record', targetCollection: '', enabled: true })
  const [pullSymbol, setPullSymbol] = useState('BTC')
  const [editing, setEditing] = useState({})
  const [thresholds, setThresholds] = useState({})

  const load = async (silent = false) => {
    try {
      const data = await api('/state')
      setState(data.state)
      setOnline(true)
      if (!silent) setError('')
    } catch (e) { setOnline(false); if (!silent) setError(e.message) }
  }
  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load(true) }, 4500)
    return () => clearInterval(timer)
  }, [])

  const act = async (path, method, body, message = 'Saved') => {
    if (busy) return false
    setBusy(true); setError(''); setNotice('')
    try {
      await api(path, { method, body })
      setNotice(message)
      await load(true)
      return true
    } catch (e) { setError(e.message); return false } finally { setBusy(false) }
  }
  const confirmDelete = (question, path) => {
    if (window.confirm(question)) void act(path, 'DELETE', null, 'Deleted')
  }
  const selectedAsset = state.assets.find(a => a.symbol === assetSymbol) || state.assets[0]
  const assetDraft = editing.symbol === selectedAsset?.symbol ? editing : (selectedAsset
    ? { symbol: selectedAsset.symbol, name: selectedAsset.name, assetClass: selectedAsset.assetClass } : {})
  const setDraft = update => setEditing(p => ({ ...(p.symbol === selectedAsset?.symbol ? p : assetDraft), ...update }))
  const market = state.dataManager

  return <div className="shell">
    <aside className="sidebar">
      <div className="logo"><span className="logo-square">T<span>↗</span></span><div>TRADING <strong>ECOSYSTEM</strong><small>VERSION 01 · MVP</small></div></div>
      <div className="navlabel">WORKSPACE / PILLARS</div>
      <nav>{sections.map(([key, title, icon], i) => <button key={key} className={tab === key ? 'navitem active' : 'navitem'} onClick={() => setTab(key)}>
        <span className="navicon">{icon}</span><span>{title}</span><span className="navnumber">0{i + 1}</span>
      </button>)}</nav>
      <div className="sidebar-footer"><span className={'dot ' + (online ? 'on' : '')}></span>
        <span>{online ? 'MongoDB + API connected' : 'Backend disconnected'}</span></div>
    </aside>

    <div className="main">
      <header className="topbar"><div className="crumb">TRADING ECOSYSTEM <span>/</span> {sections.find(i => i[0] === tab)?.[1].toUpperCase()}</div>
        <div className="topright"><Badge good={online}>{online ? '● CONNECTED' : '○ OFFLINE'}</Badge>
          <button className="quiet small" onClick={() => void load()}>↻ Refresh</button></div></header>
      <main>
        {error && <div className="notice error"><strong>Something needs attention:</strong> {error} {!online && <span>Start the backend on port 3001 and confirm its MongoDB URI.</span>}</div>}
        {notice && <div className="notice success">{notice}</div>}
        <div className="stats">
          <div><small>REGISTERED ASSETS</small><strong>{state.assets.length}</strong></div>
          <div><small>COLLECTIONS</small><strong>{state.collections.length}</strong></div>
          <div><small>ACTIVE SCANNERS</small><strong>{state.scanner.running.length}</strong></div>
          <div><small>LIVE MARKET QUOTES</small><strong>{market.quotes?.length || 0}</strong></div>
        </div>

        {tab === 'registry' && <Section eyebrow="PILLAR 01 / CANONICAL IDENTITY" title="Asset Registry" description="One asset per symbol. All collections, providers and processes reference this shared identity.">
          <div className="grid two">
            <div className="panel"><h2>Register an asset</h2><p className="hint">Saves to MongoDB; an existing symbol is not duplicated.</p>
              <form className="form" onSubmit={async e => { e.preventDefault(); if (await act('/assets', 'POST', newAsset, 'Asset registered')) setNewAsset({ symbol: '', name: '', assetClass: 'crypto' }) }}>
                <Field label="SYMBOL"><input required placeholder="BTC" value={newAsset.symbol} onChange={e => setNewAsset({ ...newAsset, symbol: e.target.value.toUpperCase() })}/></Field>
                <Field label="NAME (OPTIONAL)"><input placeholder="Bitcoin" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}/></Field>
                <Field label="ASSET CLASS"><select value={newAsset.assetClass} onChange={e => setNewAsset({ ...newAsset, assetClass: e.target.value })}>
                  <option value="crypto">Crypto</option><option value="stock">Stock</option><option value="unknown">Unknown</option></select></Field>
                <button disabled={busy}>+ Register asset</button>
              </form></div>
            <div className="panel"><h2>Registry overview</h2><p className="hint">Canonical records / no duplicates.</p>
              <div className="metric"><strong>{state.assets.length}</strong><span>Total saved</span></div>
              <div className="metric"><strong>{state.assets.filter(a => a.assetClass === 'crypto').length}</strong><span>Crypto assets</span></div>
              <div className="metric"><strong>{state.assets.filter(a => a.assetClass === 'stock').length}</strong><span>Stocks</span></div>
              <div className="info">Coinbase market data can register a missing supported crypto asset automatically.</div>
            </div>
          </div>
          <div className="panel"><div className="panel-heading"><h2>Asset records</h2><span className="count">{state.assets.length} ITEMS</span></div>
            {!state.assets.length ? <Empty>No assets yet. Register one above or pull a Coinbase ticker in Data Manager.</Empty> : <div className="tablewrap"><table><thead><tr><th>SYMBOL</th><th>NAME</th><th>CLASS</th><th>MARKETS</th><th></th></tr></thead><tbody>
              {state.assets.map(a => <tr key={a.id}><td className="strong">{a.symbol}</td><td>{a.name || '—'}</td><td><Badge>{a.assetClass}</Badge></td><td>{a.markets?.length || 0}</td>
                <td className="right"><button className="textbtn" onClick={() => { setAssetSymbol(a.symbol); setTab('asset') }}>Open →</button></td></tr>)}
            </tbody></table></div>}</div>
        </Section>}

        {tab === 'asset' && <Section eyebrow="PILLAR 02 / ASSET DOCUMENT" title="Asset" description="Edit a saved asset. Market identifiers record where its prices come from.">
          {!state.assets.length ? <div className="panel"><Empty>Register an asset first in Asset Registry.</Empty></div> : <div className="grid two">
            <div className="panel"><h2>Asset details</h2>
              <Field label="SELECT ASSET"><select value={selectedAsset?.symbol || ''} onChange={e => { setAssetSymbol(e.target.value); setEditing({}) }}>
                {state.assets.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}</select></Field>
              <form className="form" onSubmit={e => { e.preventDefault(); void act('/assets/' + encodeURIComponent(selectedAsset.symbol), 'PATCH',
                { name: assetDraft.name, assetClass: assetDraft.assetClass }, 'Asset updated') }}>
                <Field label="SYMBOL (IMMUTABLE)"><input value={selectedAsset.symbol} readOnly/></Field>
                <Field label="DISPLAY NAME"><input value={assetDraft.name || ''} onChange={e => setDraft({ name: e.target.value })}/></Field>
                <Field label="CLASS"><select value={assetDraft.assetClass || 'unknown'} onChange={e => setDraft({ assetClass: e.target.value })}>
                  <option value="crypto">Crypto</option><option value="stock">Stock</option><option value="unknown">Unknown</option></select></Field>
                <div className="formbuttons"><button disabled={busy}>Save changes</button><button type="button" className="danger-btn" disabled={busy}
                  onClick={() => confirmDelete('Permanently delete ' + selectedAsset.symbol + '? This also removes it from collections.', '/assets/' + encodeURIComponent(selectedAsset.symbol))}>Delete asset</button></div>
              </form></div>
            <div className="panel"><h2>Market identifiers</h2><p className="hint">Markets discovered from accepted provider data.</p>
              {selectedAsset.markets?.length ? selectedAsset.markets.map((m, i) => <div className="row" key={i}><div><strong>{m.marketSymbol}</strong><small>{m.provider}</small></div><Badge good>REGISTERED</Badge></div>) : <Empty>No markets recorded yet. Pull a supported Coinbase quote for a new asset.</Empty>}
              <div className="info">Price ticks are not stored in this document. Live values are owned by Data Manager.</div>
            </div>
          </div>}
        </Section>}

        {tab === 'collections' && <Section eyebrow="PILLAR 03 / ORGANIZATION" title="Collections" description="A named set of Asset references. Add or remove assets without changing their canonical records.">
          <div className="panel"><h2>Create collection</h2><form className="inline-form" onSubmit={async e => { e.preventDefault(); if (await act('/collections', 'POST', { name: newCollection }, 'Collection created')) setNewCollection('') }}>
            <input required placeholder="e.g. premarket-watchlist" value={newCollection} onChange={e => setNewCollection(e.target.value)}/><button disabled={busy}>+ Create</button>
          </form></div>
          <div className="grid two">{state.collections.map(c => <div className="panel" key={c.id}>
            <div className="panel-heading"><h2>{c.name}</h2><button className="textbtn danger" onClick={() => confirmDelete('Delete collection ' + c.name + '?', '/collections/' + c.id)}>Delete</button></div>
            <div className="chips">{c.assets.length ? c.assets.map(symbol => <span className="chip" key={symbol}>{symbol}<button title={'Remove ' + symbol} disabled={busy} onClick={() => void act(`/collections/${c.id}/assets/${encodeURIComponent(symbol)}`, 'DELETE', null, 'Asset removed')}>×</button></span>) : <span className="hint">No assets assigned</span>}</div>
            <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (await act('/collections/' + c.id + '/assets', 'POST', { symbol: addAsset[c.id] }, 'Asset added')) setAddAsset({ ...addAsset, [c.id]: '' }) }}>
              <select required value={addAsset[c.id] || ''} onChange={e => setAddAsset({ ...addAsset, [c.id]: e.target.value })}>
                <option value="">Choose asset...</option>{state.assets.filter(a => !c.assets.includes(a.symbol)).map(a => <option key={a.symbol}>{a.symbol}</option>)}</select>
              <button disabled={busy}>+ Add</button></form></div>)}</div>
          {!state.collections.length && <div className="panel"><Empty>No collections yet.</Empty></div>}
        </Section>}

        {tab === 'processes' && <Section eyebrow="PILLAR 04 / SAVED WORK" title="Processes" description="Saved scanner configurations. The shared Scanner Engine runs enabled scanners; Discovery is reserved for later.">
          <div className="panel"><h2>Create process</h2><form className="inline-form wrap" onSubmit={async e => { e.preventDefault(); if (await act('/processes', 'POST', newProcess, 'Process created')) setNewProcess({ name: '', kind: 'scanner', minChangePct: '5' }) }}>
            <input required placeholder="e.g. momentum" value={newProcess.name} onChange={e => setNewProcess({ ...newProcess, name: e.target.value })}/>
            <select value={newProcess.kind} onChange={e => setNewProcess({ ...newProcess, kind: e.target.value })}><option value="scanner">Scanner</option><option value="discovery">Discovery (placeholder)</option></select>
            <input className="number" type="number" min="0" max="1000" step=".5" title="Minimum 5-minute % gain" value={newProcess.minChangePct} onChange={e => setNewProcess({ ...newProcess, minChangePct: e.target.value })}/>
            <button disabled={busy}>+ Create</button>
          </form></div>
          <div className="grid two">{state.processes.map(p => {
            const running = state.scanner.running.find(s => s.id === p.id)
            return <div className="panel" key={p.id}><div className="panel-heading"><h2>{p.name}</h2><Badge good={p.enabled}>{p.enabled ? 'RUNNING' : 'STOPPED'}</Badge></div>
              <p className="hint">{p.kind.toUpperCase()} · 5-minute positive change filter</p>
              {p.kind === 'scanner' && <form className="inline-form" onSubmit={e => { e.preventDefault(); void act('/processes/' + p.id, 'PATCH',
                { minChangePct: Number(thresholds[p.id] ?? p.minChangePct) }, 'Scanner filter saved') }}>
                <Field label="MIN % CHANGE"><input type="number" min="0" max="1000" step=".1" value={thresholds[p.id] ?? p.minChangePct}
                  onChange={e => setThresholds({ ...thresholds, [p.id]: e.target.value })}/></Field>
                <button disabled={busy}>Save filter</button>
              </form>}
              <div className="metric"><strong>{running?.symbols.length || 0}</strong><span>monitored symbols</span></div>
              <div className="metric"><strong>{running?.matches.length || 0}</strong><span>current matches</span></div>
              <div className="formbuttons">
                <button disabled={busy || p.kind === 'discovery'} onClick={() => void act('/processes/' + p.id, 'PATCH', { enabled: !p.enabled }, p.enabled ? 'Scanner stopped' : 'Scanner started')}>{p.enabled ? '■ Stop' : '▶ Start'}</button>
                <button className="danger-btn" disabled={busy} onClick={() => confirmDelete('Delete process ' + p.name + '?', '/processes/' + p.id)}>Delete</button>
              </div>
              {running?.matches?.length > 0 && <div className="matches">{running.matches.map(m => <div className="row" key={m.symbol}><strong>{m.symbol}</strong><span className="green">+{m.changePct.toFixed(2)}%</span></div>)}</div>}
            </div>
          })}</div>{!state.processes.length && <div className="panel"><Empty>No processes. Create a scanner, subscribe it to a collection, then start it.</Empty></div>}
        </Section>}

        {tab === 'subscriptions' && <Section eyebrow="PILLAR 05 / RELATIONSHIPS" title="Subscriptions" description="Connect a Process to a Collection. Multiple scanners can share one upstream price stream.">
          <div className="panel"><h2>Add subscription</h2><form className="inline-form wrap" onSubmit={async e => { e.preventDefault(); if (await act('/subscriptions', 'POST', newSub, 'Subscription saved')) setNewSub({ processId: '', collectionId: '' }) }}>
            <select required value={newSub.processId} onChange={e => setNewSub({ ...newSub, processId: e.target.value })}><option value="">Select process...</option>
              {state.processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <span className="arrow">→</span><select required value={newSub.collectionId} onChange={e => setNewSub({ ...newSub, collectionId: e.target.value })}><option value="">Select collection...</option>
              {state.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button disabled={busy}>+ Subscribe</button></form></div>
          <div className="panel"><div className="panel-heading"><h2>Current subscriptions</h2><span className="count">{state.subscriptions.length} LINKS</span></div>
            {!state.subscriptions.length ? <Empty>No subscriptions yet.</Empty> : <div className="tablewrap"><table><thead><tr><th>PROCESS</th><th>COLLECTION</th><th></th></tr></thead><tbody>
              {state.subscriptions.map(s => <tr key={s.id}><td className="strong">{s.processName}</td><td>{s.collectionName}</td><td className="right">
                <button className="textbtn danger" disabled={busy} onClick={() => void act('/subscriptions/' + s.id, 'DELETE', null, 'Unsubscribed')}>Remove</button></td></tr>)}</tbody></table></div>}
          </div><div className="info">Subscriptions are saved in MongoDB. Starting a scanner subscribes its collection assets to Data Manager (supported Coinbase symbols only).</div>
        </Section>}

        {tab === 'events' && <Section eyebrow="PILLAR 06 / REACTIONS" title="Events" description="Data and process events are emitted in memory; configurable listeners live in MongoDB. No snapshots or separate action processes.">
          <div className="grid two"><div className="panel"><h2>New event listener</h2>
            <form className="form" onSubmit={async e => { e.preventDefault(); if (await act('/events/rules', 'POST', newRule, 'Event listener created')) setNewRule({ name: '', trigger: 'market.data.received', symbol: '', action: 'alert.record', targetCollection: '', enabled: true }) }}>
              <Field label="NAME"><input required placeholder="btc-price-alert" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })}/></Field>
              <Field label="TRIGGER"><select value={newRule.trigger} onChange={e => setNewRule({ ...newRule, trigger: e.target.value })}>
                {['market.data.received', 'asset.created', 'scanner.match', 'collection.asset.added', 'process.started'].map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="SYMBOL FILTER (OPTIONAL)"><input placeholder="BTC" value={newRule.symbol} onChange={e => setNewRule({ ...newRule, symbol: e.target.value.toUpperCase() })}/></Field>
              <Field label="ACTION"><select value={newRule.action} onChange={e => setNewRule({ ...newRule, action: e.target.value })}>
                <option value="alert.record">Record alert</option><option value="collection.add">Add asset to collection</option></select></Field>
              {newRule.action === 'collection.add' && <Field label="DESTINATION COLLECTION"><select required value={newRule.targetCollection} onChange={e => setNewRule({ ...newRule, targetCollection: e.target.value })}>
                <option value="">Choose collection...</option>{state.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
              <label className="checkbox"><input type="checkbox" checked={newRule.enabled} onChange={e => setNewRule({ ...newRule, enabled: e.target.checked })}/> Enabled</label>
              <button disabled={busy}>+ Add event listener</button>
            </form></div>
            <div className="panel"><h2>Saved listeners</h2>{!state.rules.length ? <Empty>No event listeners yet.</Empty> : state.rules.map(r => <div className="row" key={r.id}>
              <div><strong>{r.name}</strong><small>{r.trigger} → {r.action}{r.symbol ? ' · ' + r.symbol : ''}</small></div><div className="row-actions">
                <button className="textbtn" disabled={busy} onClick={() => void act('/events/rules/' + r.id, 'PATCH', {
                  name: r.name, trigger: r.trigger, symbol: r.symbol, action: r.action,
                  targetCollection: r.targetCollection, enabled: !r.enabled }, 'Rule updated')}>{r.enabled ? 'On' : 'Off'}</button>
                <button className="textbtn danger" disabled={busy} onClick={() => confirmDelete('Delete rule ' + r.name + '?', '/events/rules/' + r.id)}>×</button>
              </div></div>)}</div></div>
          <div className="grid two"><div className="panel"><h2>Recent events <span className="count">RAM ONLY</span></h2>
            <div className="log">{!state.events.recent.length ? <Empty>Events will appear when the backend receives data or records changes.</Empty> : state.events.recent.slice(0, 25).map((ev, i) => <div className="logrow" key={ev.id || i}><span className="logtime">{stamp(ev.at)}</span><span className="logtype">{ev.type}</span><span>{ev.data?.symbol || ev.data?.message || '—'}</span></div>)}</div>
          </div><div className="panel"><h2>Alerts <span className="count">{state.events.alerts.length}</span></h2>
            {!state.events.alerts.length ? <Empty>No alerts recorded yet.</Empty> : state.events.alerts.map((a, i) => <div className="row" key={a.id + i}>
              <div><strong>{a.rule}</strong><small>{a.event} · {a.symbol || 'global'} · {stamp(a.at)}</small></div><Badge good>ALERT</Badge></div>)}</div></div>
        </Section>}

        {tab === 'data' && <Section eyebrow="PILLAR 07 / MARKET INFRASTRUCTURE" title="Data Manager" description="The sole entry point for REST and WebSocket market updates. Valid incoming quotes produce Events and can register missing assets.">
          <div className="grid two">
            <div className="panel"><h2>Coinbase connection</h2>
              <div className="row"><span>WebSocket</span><Badge good={market.websocket === 'connected'}>{market.websocket?.toUpperCase()}</Badge></div>
              <div className="row"><span>REST calls / minute</span><strong>{market.restCallsLastMinute || 0} / {market.restLimit || 25}</strong></div>
              <div className="row"><span>Streaming symbols</span><strong>{market.activeSymbols?.length || 0}</strong></div>
              {market.error && <div className="notice error">{market.error}</div>}
              <div className="info">One shared WebSocket, deduplicated across scanners. The live stream connects when an enabled scanner has supported assets.</div>
            </div>
            <div className="panel"><h2>Pull live ticker</h2><p className="hint">Uses the public Coinbase REST API; no API key needed.</p>
              <form className="form" onSubmit={e => { e.preventDefault(); void act('/data/pull', 'POST', { symbol: pullSymbol }, pullSymbol + ' quote received') }}>
                <Field label="SUPPORTED MARKET"><select value={pullSymbol} onChange={e => setPullSymbol(e.target.value)}>
                  {(market.supportedSymbols?.length ? market.supportedSymbols : ['BTC','ETH','SOL','DOGE','ADA','AVAX','LINK','LTC','XRP']).map(s => <option key={s}>{s}</option>)}</select></Field>
                <button disabled={busy}>↗ Request quote</button></form>
              <div className="info">A successful quote emits market.data.received. If the asset is missing, Asset Registry creates it.</div>
            </div>
          </div>
          <div className="panel"><div className="panel-heading"><h2>Latest market data</h2><span className="count">{market.quotes?.length || 0} QUOTES</span></div>
            {!market.quotes?.length ? <Empty>No live quotes yet. Request one above or start a subscribed scanner.</Empty> : <div className="tablewrap"><table><thead><tr><th>SYMBOL</th><th>PRICE (USD)</th><th>5M CHANGE</th><th>PROVIDER</th><th>LAST UPDATE</th></tr></thead>
              <tbody>{market.quotes.map(q => <tr key={q.symbol}><td className="strong">{q.symbol}</td><td>${Number(q.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                <td className={q.changePct >= 0 ? 'green' : 'red'}>{q.changePct > 0 ? '+' : ''}{q.changePct.toFixed(2)}%</td><td>{q.provider}</td><td>{stamp(q.timestamp)}</td></tr>)}</tbody></table></div>}</div>
          {market.unsupported?.length > 0 && <div className="notice error">No V1 provider adapter for: {market.unsupported.join(', ')}</div>}
        </Section>}
      </main>
      <footer>Trading Ecosystem V1 · Seven-pillar MVP <span>Backend required · No simulated prices</span></footer>
    </div>
  </div>
}

export default App
