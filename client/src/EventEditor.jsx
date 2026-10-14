import { useEffect, useState } from 'react'

const blankRule = () => ({
  name: '', trigger: 'market.momentum.detected', scope: 'global', targetId: '',
  enabled: false, intervalSeconds: 300,
  conditions: [{ path: 'data.symbol', operator: 'eq', value: 'BTC' }],
  actions: [
    { type: 'snapshot.capture', config: { type: 'market-event' } },
    { type: 'alert.record', config: { message: 'Momentum detected' } },
  ],
})

function ruleToForm(rule) {
  if (!rule) return blankRule()
  return {
    name: rule.name, trigger: rule.trigger, scope: rule.target?.scope || 'global',
    targetId: rule.target?.id || '', enabled: rule.enabled || false, intervalSeconds: rule.intervalSeconds || 300,
    conditions: (rule.conditions || []).map(c => ({ path: c.path, operator: c.operator, value: c.value })),
    actions: (rule.actions || []).map(a => ({ type: a.type, config: a.config || {} })),
  }
}

function RuleEditor({ workspace, onManage, onCommand, busy, demoMode, onSimulate }) {
  const rules = workspace.eventRules || []
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState(blankRule)
  const exists = rules.some(r => r.name === selected)
  const choice = rules.find(r => r.name === selected)
  useEffect(() => { if (choice) setForm(ruleToForm(choice)) }, [selected])
  const change = (key, value) => setForm(p => ({ ...p, [key]: value }))
  const changeArray = (key, index, field, value) => setForm(p => ({
    ...p, [key]: p[key].map((item, i) => i === index ? { ...item, [field]: value } : item),
  }))
  const sourceSuggestions = {
    asset: (workspace.assetDetails || []).map(i => i.symbol),
    collection: (workspace.collections || []).map(i => i.name),
    process: (workspace.processes || []).map(i => i.name),
    membership: (workspace.memberships || []).map(i => i.id),
  }
  const save = async e => {
    e.preventDefault()
    const validated = {
      ...form, trigger: form.trigger === 'schedule.tick' ? `schedule.${form.name}` : form.trigger, conditions: form.conditions.map(c => ({
        ...c, value: ['gt','gte','lt','lte'].includes(c.operator) ? Number(c.value) : c.value,
      })),
    }
    const ok = await onManage('rule.save', validated)
    if (ok) setSelected(form.name)
  }
  return <section className="panel rule-edit-panel">
    <div className="panel-title"><span className="section-number">01</span><div>
      <h2>Event rules</h2><p>Choose a rule to edit or create a new one. All actions are predefined and validated.</p>
    </div></div>
    <div className="rule-chooser">
      {rules.map(rule => <button key={rule.name} className={selected === rule.name ? 'rule-choice active' : 'rule-choice'}
        onClick={() => setSelected(rule.name)}>
        <span><strong>{rule.name}</strong><small>{rule.trigger}</small></span>
        <span className={rule.enabled ? 'pill live' : 'pill'}>{rule.enabled ? 'On' : 'Off'}</span>
      </button>)}
      <button className={!selected ? 'rule-choice active' : 'rule-choice'} onClick={() => { setSelected(''); setForm(blankRule()) }}>
        <strong>+ New event rule</strong>
      </button>
    </div>
    {demoMode ? <>
      <p className="editor-hint">This is a visual preview. Open your running Codespaces preview to save changes in MongoDB.</p>
      <button onClick={onSimulate}>⚡ Simulate BTC +5% event</button>
    </> : <>
      <form onSubmit={save} className="event-form">
        <div className="edit-grid">
          <label>Rule name
            <input required maxLength="40" pattern="[a-z0-9][a-z0-9_-]*" value={form.name}
              readOnly={exists} onChange={e => change('name', e.target.value.toLowerCase())} placeholder="btc-momentum"/>
          </label>
          <label>Trigger
            <input required list="available-triggers" value={form.trigger} onChange={e => change('trigger', e.target.value)} placeholder="market.momentum.detected"/>
            <datalist id="available-triggers">
              {['market.data.received','market.momentum.detected','schedule.tick','asset.created','asset.updated','collection.created','membership.added','membership.removed','membership.updated','process.started','process.stopped','snapshot.created'].map(t => <option key={t} value={t}/>)}
            </datalist>
          </label>
          <label>Attached to
            <select value={form.scope} onChange={e => { change('scope', e.target.value); setForm(p => ({ ...p, targetId: '' })) }}>
              {['global','asset','collection','membership','process','subscription','snapshot'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {form.scope !== 'global' && <label>Target ID
            <input required list="available-targets" value={form.targetId} onChange={e => change('targetId', e.target.value)} placeholder="Symbol, collection name or record ID"/>
            <datalist id="available-targets">{(sourceSuggestions[form.scope] || []).map(id => <option key={id} value={id}/>)}</datalist>
          </label>}
        </div>
        {form.trigger.startsWith('schedule.') || form.trigger === 'schedule.tick' ? <label>Schedule every (seconds)
          <input type="number" min="5" max="86400" value={form.intervalSeconds} onChange={e => change('intervalSeconds', Number(e.target.value))}/>
          <small className="hint">Use schedule.tick; saved as schedule.&lt;rule-name&gt;.</small>
        </label> : null}
        <label className="check-label"><input type="checkbox" checked={form.enabled} onChange={e => change('enabled', e.target.checked)}/> Enabled (execute actions when a matching event occurs)</label>
        <div className="editor-subtitle">Conditions <small>All conditions must match. Leave empty to match every event of this type.</small></div>
        {form.conditions.map((c,i) => <div className="condition-row" key={i}>
          <input aria-label="Condition data path" value={c.path} placeholder="data.changePct" onChange={e => changeArray('conditions', i, 'path', e.target.value)}/>
          <select aria-label="Condition operator" value={c.operator} onChange={e => changeArray('conditions', i, 'operator', e.target.value)}>
            {[['eq','equals'],['ne','not equal'],['gte','≥'],['gt','>'],['lte','≤'],['lt','<']].map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input aria-label="Condition value" type={['gt','gte','lt','lte'].includes(c.operator) ? 'number' : 'text'}
            value={c.value ?? ''} onChange={e => changeArray('conditions',i,'value',e.target.value)}/>
          <button type="button" className="quiet" onClick={() => setForm(p => ({ ...p, conditions: p.conditions.filter((_,j) => j !== i) }))}>×</button>
        </div>)}
        <button className="quiet small-action" type="button" onClick={() => setForm(p => ({ ...p, conditions: [...p.conditions, { path: 'data.changePct', operator: 'gte', value: 5 }] }))}>+ Add condition</button>
        <div className="editor-subtitle">Actions <small>Executed in order.</small></div>
        {form.actions.map((a,i) => <div className="action-edit-row" key={i}>
          <select value={a.type} aria-label="Action type" onChange={e => setForm(p => ({
            ...p, actions: p.actions.map((x,j) => j === i ? { type: e.target.value, config: {} } : x),
          }))}>
            <option value="snapshot.capture">Capture snapshot</option>
            <option value="alert.record">Record in-app alert</option>
            <option value="collection.add">Add asset to collection</option>
          </select>
          <input aria-label="Action setting" required placeholder={a.type === 'collection.add' ? 'Destination collection' : a.type === 'alert.record' ? 'Alert message' : 'Snapshot type'}
            value={a.type === 'collection.add' ? (a.config?.collection || '') : a.type === 'alert.record' ? (a.config?.message || '') : (a.config?.type || '')}
            onChange={e => {
              const key = a.type === 'collection.add' ? 'collection' : a.type === 'alert.record' ? 'message' : 'type'
              setForm(p => ({ ...p, actions: p.actions.map((x,j) => j === i ? { ...x, config: { [key]: e.target.value } } : x) }))
            }}/>
          <button type="button" className="quiet" disabled={form.actions.length <= 1} onClick={() => setForm(p => ({ ...p, actions: p.actions.filter((_,j) => j !== i) }))}>×</button>
        </div>)}
        <button className="quiet small-action" type="button" onClick={() => setForm(p => ({ ...p, actions: [...p.actions, { type: 'alert.record', config: { message: '' } }] }))}>+ Add action</button>
        <div className="editor-actions">
          <button disabled={busy || !form.name || !form.trigger}>Save event rule</button>
          {exists && <button className="text-button danger" type="button" disabled={busy}
            onClick={async () => {
              if (window.confirm('Delete event rule ' + selected + '?')) {
                const ok = await onManage('rule.delete', { name: selected })
                if (ok) { setSelected(''); setForm(blankRule()) }
              }
            }}>Delete rule</button>}
        </div>
        <p className="hint">Rules only react to events emitted by the backend. Market data emits market.data.received on every valid tick. Schedule rules use per-rule intervals. Alert recording is in-app, not email.</p>
      </form>
      <div className="action-row">
        <button className="secondary" disabled={busy} onClick={() => onCommand('demo trigger')}>⚡ Test simulated BTC +5%</button>
        <button className="quiet" disabled={busy} onClick={() => onCommand('demo seed')}>Load example records</button>
      </div>
    </>}
  </section>
}

export default function EventEditor({ workspace, demoMode, onManage, onCommand, onSimulate, busy }) {
  return <div className="automation-edit-stack">
    <RuleEditor workspace={workspace} demoMode={demoMode} onManage={onManage} onCommand={onCommand} onSimulate={onSimulate} busy={busy}/>
    <section className="panel">
      <div className="panel-title"><span className="section-number">04</span><div>
        <h2>Scheduled actions</h2>
        <p>Snapshots are actions, not processes. Create an event rule with trigger <code>schedule.tick</code>, select Capture snapshot, and set the interval.</p>
      </div></div>
    </section>
  </div>
}
