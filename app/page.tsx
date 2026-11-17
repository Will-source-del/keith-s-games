import Link from "next/link";

const games = [
  {
    name: "Slingshot Adventures",
    description: "Aim, launch and complete challenges.",
    icon: "🐦",
    category: "ARCADE",
    href: "/games/slingshot",
    accent: "orange"
  },
  {
    name: "Checkers",
    description: "Play against the computer.",
    icon: "🔴",
    category: "STRATEGY",
    href: "/games/checkers",
    accent: "red"
  },
  {
    name: "Solitaire",
    description: "A classic card game.",
    icon: "🃏",
    category: "CARD GAME",
    href: "/games/solitaire",
    accent: "green"
  },
  {
    name: "Sudoku",
    description: "Put your number skills to the test.",
    icon: "🔢",
    category: "PUZZLE",
    href: "/games/sudoku",
    accent: "blue"
  },
  {
    name: "Minesweeper",
    description: "Find the safe squares.",
    icon: "💣",
    category: "PUZZLE",
    href: "/games/minesweeper",
    accent: "purple"
  },
  {
    name: "Memory Match",
    description: "Find all the matching pairs.",
    icon: "🧠",
    category: "BRAIN TRAINING",
    href: "/games/memory",
    accent: "pink"
  }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="app-brand">
          <span className="app-brand-icon">🎮</span>
          <span>Keith's Games</span>
        </Link>

        <div className="sidebar-label">MENU</div>

        <nav className="sidebar-nav">
          <Link href="/" className="sidebar-link active">
            <span>⌂</span>
            Home
          </Link>
          <a href="#games" className="sidebar-link">
            <span>▦</span>
            All games
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user-icon">K</div>
          <div>
            <strong>Keith</strong>
            <span>Player</span>
          </div>
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div>
            <span className="app-date-label">YOUR GAME LIBRARY</span>
            <h1>Welcome back, Keith</h1>
          </div>
          <div className="app-player-badge">
            <span>●</span> Ready to play
          </div>
        </header>

        <section className="app-feature">
          <div className="app-feature-content">
            <span className="app-feature-label">YOUR PERSONAL ARCADE</span>
            <h2>What would you like to play?</h2>
            <p>Choose a game and pick up where you left off.</p>
            <a href="#games" className="app-feature-button">
              Browse games <span>→</span>
            </a>
          </div>
          <div className="app-feature-art">🎮</div>
        </section>

        <section className="app-games-section" id="games">
          <div className="app-section-heading">
            <div>
              <span className="app-section-label">THE COLLECTION</span>
              <h2>All games</h2>
            </div>
            <span className="app-game-count">{games.length} games</span>
          </div>

          <div className="app-games-grid">
            {games.map((game) => (
              <Link
                href={game.href}
                className={`app-game-card ${game.accent}`}
                key={game.name}
              >
                <div className="app-game-card-top">
                  <div className="app-game-icon">{game.icon}</div>
                  <span className="app-game-arrow">↗</span>
                </div>
                <span className="app-game-category">{game.category}</span>
                <h3>{game.name}</h3>
                <p>{game.description}</p>
                <span className="app-play-link">Play now <span>→</span></span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="app-footer">
          Keith's Games <span>•</span> Made for Keith
        </footer>
      </section>
    </main>
  );
}
