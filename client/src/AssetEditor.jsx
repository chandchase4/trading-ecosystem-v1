import { useEffect, useMemo, useState } from 'react'

function MembershipEditor({ item, markets, collections, onManage, onCommand, busy }) {
  const [form, setForm] = useState({
    provider: item.preferences?.provider || '', exchange: item.preferences?.exchange || '',
    marketSymbol: item.preferences?.marketSymbol || '', priority: item.preferences?.priority ?? 50,
    notes: item.preferences?.notes || '',
  })
  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const selectedMarket = markets.find(m => m.symbol === form.marketSymbol && m.provider === form.provider)
  return <div className="editor-card membership-editor">
    <div className="editor-card-title"><strong>{item.collection}</strong><span className="editor-kicker">MEMBERSHIP</span></div>
    <div className="edit-grid">
      <label>Market preference
        <select value={selectedMarket ? markets.indexOf(selectedMarket) : -1}
          onChange={e => {
            const m = markets[Number(e.target.value)]
            if (m) setForm(prev => ({ ...prev, marketSymbol: m.symbol, provider: m.provider, exchange: m.exchange }))
            else setForm(prev => ({ ...prev, marketSymbol: '', provider: '', exchange: '' }))
          }}>
          <option value={-1}>Auto / no selection</option>
          {markets.map((m,i) => <option key={m.provider + m.symbol + i} value={i}>{m.symbol} · {m.provider} / {m.exchange}</option>)}
        </select>
      </label>
      <label>Priority (0–100)
        <input type="number" min="0" max="100" value={form.priority} onChange={e => change('priority', e.target.value)}/>
      </label>
    </div>
    <label>Notes
      <input maxLength="500" value={form.notes} onChange={e => change('notes', e.target.value)} placeholder="Context-specific notes"/>
    </label>
    <div className="editor-actions">
      <button disabled={busy} onClick={() => onManage('membership.update', { id: item.id, ...form })}>Save membership</button>
      <button className="text-button danger" disabled={busy}
        onClick={() => { if (window.confirm('Remove this asset from ' + item.collection + '?')) onCommand('collection remove ' + item.collection + ' ' + item.asset) }}>Remove from list</button>
    </div>
    <small className="hint">Saved preferences are ready for future market routing; Coinbase is still the only connected provider.</small>
  </div>
}

function ProviderEditor({ provider, busy, onManage }) {
  const [enabled, setEnabled] = useState(provider.settings?.enabled || false)
  const [priority, setPriority] = useState(provider.settings?.priority || 100)
  return <div className="directory-provider">
    <div className="editor-card-title"><strong>{provider.name}</strong><span className="tiny">{provider.capabilities?.join(' · ')}</span></div>
    <div className="edit-grid">
      <label>Preference rank
        <input type="number" min="1" max="10000" value={priority} onChange={e => setPriority(e.target.value)}/>
      </label>
      <label className="check-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/> Enabled in configuration</label>
    </div>
    <button className="secondary" disabled={busy} onClick={() => onManage('provider.update', { slug: provider.slug, enabled, priority })}>Save provider settings</button>
  </div>
}

export default function AssetEditor({ workspace, onCommand, onManage, busy }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [newSymbol, setNewSymbol] = useState('')
  const [details, setDetails] = useState({ name: '', assetClass: 'unknown', note: '' })
  const [market, setMarket] = useState({ marketSymbol: '', provider: '', exchange: '', quote: 'USD', activityRank: 1 })
  const [addCollection, setAddCollection] = useState('')
  const allAssets = workspace.assetDetails || []
  const selectedAsset = allAssets.find(item => item.symbol === selected)
  const filtered = useMemo(() => allAssets.filter(a => (a.symbol + ' ' + a.name).toLowerCase().includes(search.toLowerCase())), [allAssets, search])
  useEffect(() => {
    if (!selectedAsset && allAssets.length) setSelected(allAssets[0].symbol)
  }, [selectedAsset, allAssets])
  useEffect(() => {
    if (selectedAsset) setDetails({ name: selectedAsset.name || '', assetClass: selectedAsset.assetClass || 'unknown', note: selectedAsset.userData?.note || '' })
  }, [selectedAsset?.id, selected])
  const memberships = (workspace.memberships || []).filter(m => m.asset === selected)
  const availableCollections = (workspace.collections || []).filter(c => !memberships.some(m => m.collection === c.name))
  const submitAdd = async e => {
    e.preventDefault()
    const symbol = newSymbol.trim().toUpperCase()
    if (!symbol) return
    const ok = await onCommand('asset add ' + symbol)
    if (ok) { setSelected(symbol); setNewSymbol(''); setSearch('') }
  }

  return <div className="editor-layout">
    <aside className="panel asset-sidebar">
      <div className="panel-title"><span className="section-number">01</span><div><h2>Assets</h2><p>Tap an asset to inspect and edit it.</p></div></div>
      <form className="edit-inline" onSubmit={submitAdd}>
        <input aria-label="New asset symbol" placeholder="Add symbol (e.g. AAPL)" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} maxLength="32"/>
        <button disabled={busy || !newSymbol.trim()}>Add</button>
      </form>
      <input aria-label="Search assets" className="asset-search" placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="asset-selector">
        {filtered.map(a => <button type="button" key={a.symbol}
          className={a.symbol === selected ? 'asset-choice selected' : 'asset-choice'}
          onClick={() => setSelected(a.symbol)}>
          <span className="asset-bubble">{a.symbol.slice(0,2)}</span>
          <span><strong>{a.symbol}</strong><small>{a.name || 'Unnamed asset'} · {a.assetClass || 'unknown'}</small></span>
          <span className="arrow-symbol">›</span>
        </button>)}
        {!filtered.length && <p className="empty-state">No matches. Add a new asset above.</p>}
      </div>
    </aside>
    <div className="editor-main">
      {selectedAsset ? <>
        <section className="panel">
          <div className="editor-heading"><div><p className="eyebrow">CANONICAL ASSET</p><h2>{selectedAsset.symbol} <span className="muted">/ {selectedAsset.name || 'Untitled'}</span></h2></div>
            <button className="text-button danger" disabled={busy} onClick={() => {
              if (window.confirm('Delete ' + selectedAsset.symbol + ' from the global registry AND every collection?')) onCommand('asset delete ' + selectedAsset.symbol)
            }}>Delete asset</button>
          </div>
          <div className="edit-grid">
            <label>Display name<input value={details.name} maxLength="120" onChange={e => setDetails(p => ({ ...p, name: e.target.value }))}/></label>
            <label>Asset class<select value={details.assetClass} onChange={e => setDetails(p => ({ ...p, assetClass: e.target.value }))}>
              <option value="unknown">Unknown</option><option value="stock">Stock</option><option value="crypto">Crypto</option>
            </select></label>
          </div>
          <label>My notes<textarea rows="2" value={details.note} maxLength="1000" onChange={e => setDetails(p => ({ ...p, note: e.target.value }))} placeholder="Private research notes about this asset"/></label>
          <div className="editor-actions"><button disabled={busy} onClick={() => onManage('asset.update', { symbol: selectedAsset.symbol, ...details })}>Save asset details</button></div>
        </section>
        <section className="panel">
          <div className="panel-title"><span className="section-number">02</span><div><h2>Trading markets</h2><p>Pairs and providers belong to the canonical asset. Entries you add remain unverified.</p></div></div>
          <div className="market-editor-list">
            {(selectedAsset.markets || []).map((m,i) => <div className="market-editor-row" key={m.symbol + m.provider + i}>
              <div><strong>{m.symbol}</strong><small>{m.provider} / {m.exchange} · rank {m.activityRank || '—'} {m.verified ? '· verified' : '· unverified'}</small></div>
              <button className="text-button danger" disabled={busy} onClick={() => {
                if (window.confirm('Remove this market pair?')) onManage('market.remove', {
                  symbol: selected, marketSymbol: m.symbol, provider: m.provider, exchange: m.exchange,
                })
              }}>Remove</button>
            </div>)}
            {!selectedAsset.markets?.length && <div className="empty-state">No known trading markets yet.</div>}
          </div>
          <div className="editor-subtitle">Add a trading market</div>
          <form onSubmit={async e => {
            e.preventDefault()
            const ok = await onManage('market.add', { symbol: selected, ...market })
            if (ok) setMarket({ marketSymbol: '', provider: '', exchange: '', quote: 'USD', activityRank: 1 })
          }}>
            <div className="edit-grid three">
              <label>Trading pair<input required placeholder="BTC-USDT" value={market.marketSymbol} onChange={e => setMarket(p => ({ ...p, marketSymbol: e.target.value }))}/></label>
              <label>Provider<input required placeholder="okx" value={market.provider} onChange={e => setMarket(p => ({ ...p, provider: e.target.value }))}/></label>
              <label>Exchange<input required placeholder="okx" value={market.exchange} onChange={e => setMarket(p => ({ ...p, exchange: e.target.value }))}/></label>
              <label>Quote currency<input placeholder="USDT" value={market.quote} onChange={e => setMarket(p => ({ ...p, quote: e.target.value }))}/></label>
              <label>Activity rank<input type="number" min="1" value={market.activityRank} onChange={e => setMarket(p => ({ ...p, activityRank: e.target.value }))}/></label>
            </div>
            <button disabled={busy || !market.marketSymbol || !market.provider || !market.exchange}>Add market</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-title"><span className="section-number">03</span><div><h2>Memberships</h2><p>Configure this asset differently inside each collection.</p></div></div>
          <div className="edit-inline">
            <select aria-label="Collection to add asset to" value={addCollection} onChange={e => setAddCollection(e.target.value)}>
              <option value="">Select a collection…</option>{availableCollections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <button disabled={busy || !addCollection} onClick={async () => { const ok = await onCommand('collection add ' + addCollection + ' ' + selected); if (ok) setAddCollection('') }}>Add to list</button>
          </div>
          {!workspace.collections?.length && <p className="hint">Create your first collection in Lists & scanners.</p>}
          {memberships.map(item => <MembershipEditor key={item.id} item={item} markets={selectedAsset.markets || []} collections={workspace.collections}
            busy={busy} onManage={onManage} onCommand={onCommand}/>)}
          {!memberships.length && <div className="empty-state">Not a member of any collections yet.</div>}
        </section>
      </> : <section className="panel"><h2>No asset selected</h2><p className="muted">Add an asset on the left to start editing.</p></section>}
      <section className="panel">
        <div className="panel-title"><span className="section-number">04</span><div><h2>Provider settings</h2><p>These are saved preferences, not switches that install provider adapters.</p></div></div>
        <div className="provider-grid">{workspace.providers?.map(p => <ProviderEditor key={p.slug} provider={p} busy={busy} onManage={onManage}/>)}</div>
        {!workspace.providers?.length && <div className="empty-state">No provider records yet. Seed sample providers from Events & snapshots.</div>}
      </section>
    </div>
  </div>
}
