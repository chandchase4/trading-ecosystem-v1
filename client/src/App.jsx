import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main"><span className="brand-mark" aria-hidden="true">↗</span>Market Scanner</a>
        <span className="status">Data not connected</span>
      </header>
      <main id="main">
        <section aria-labelledby="page-title">
          <p className="eyebrow">Your market workspace</p>
          <h1 id="page-title">Market Scanner</h1>
          <p className="description">A clear view of the market. A focused place to find your next opportunity.</p>
        </section>
        <section className="scanner-panel" aria-labelledby="scanner-title">
          <div className="panel-heading">
            <h2 id="scanner-title">Scanner overview</h2>
            <span className="badge">Getting started</span>
          </div>
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">⌁</span>
            <h3>Your next opportunity starts here</h3>
            <p>Market data and scanner filters are coming next. Once connected, your results will appear here.</p>
          </div>
        </section>
      </main>
      <footer>Market Scanner · Built for a clearer perspective.</footer>
    </div>
  )
}

export default App
