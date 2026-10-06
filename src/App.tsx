import SearchForm from './components/SearchForm'

export default function App() {
  return (
    <div className="page">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="How Was the Sky? Home">
          <span className="brand-sun" aria-hidden="true">☀</span>
          <span>How Was the Sky?</span>
        </a>
        <span className="header-note">A little trip back in time</span>
      </header>

      <main id="main-content" className="main-content">
        <div className="sky-illustration" aria-hidden="true">
          <div className="sun" />
          <div className="cloud cloud-back" />
          <div className="cloud cloud-front" />
        </div>
        <p className="eyebrow">Every day has a sky</p>
        <h1>How Was the Sky?</h1>
        <p className="intro">Discover what the weather was on a day that matters to you.</p>
        <SearchForm />
        <p className="memory-note">A place. A date. A moment to rediscover.</p>
      </main>

      <footer className="site-footer">Looking back, one sky at a time.</footer>
    </div>
  )
}
