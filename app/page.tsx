import Link from "next/link";

const games = [
  {
    name: "Slingshot Adventures",
    description: "Aim, launch and knock down structures.",
    icon: "🎯",
    category: "Puzzle",
    href: "/games/slingshot",
    color: "#eaf2ff"
  },
  {
    name: "Checkers",
    description: "Challenge the computer to a classic game.",
    icon: "🔴",
    category: "Board game",
    href: "/games/checkers",
    color: "#fff0ed"
  },
  {
    name: "Solitaire",
    description: "Relax with a classic card game.",
    icon: "🃏",
    category: "Cards",
    href: "/games/solitaire",
    color: "#e9f7ef"
  },
  {
    name: "Mahjong",
    description: "Match tiles and clear the board.",
    icon: "🀄",
    category: "Puzzle",
    href: "/games/mahjong",
    color: "#fff5df"
  },
  {
    name: "Sudoku",
    description: "Test your number skills.",
    icon: "🔢",
    category: "Brain training",
    href: "/games/sudoku",
    color: "#f1eaff"
  },
  {
    name: "Minesweeper",
    description: "Use logic to uncover the board.",
    icon: "💣",
    category: "Puzzle",
    href: "/games/minesweeper",
    color: "#edf1f5"
  },
  {
    name: "Memory Match",
    description: "Find all the matching pairs.",
    icon: "🧠",
    category: "Brain training",
    href: "/games/memory",
    color: "#ffeafa"
  }
];

export default function HomePage() {
  return (
    <main className="home">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">🎮</span>
          Keith's Games
        </Link>

        <nav>
          <Link href="#games">Games</Link>
          <Link href="#about">About</Link>
        </nav>
      </header>

      <section className="welcome">
        <div className="welcome-content">
          <span className="eyebrow">YOUR PERSONAL GAME COLLECTION</span>
          <h1>Welcome to Keith's Games.</h1>
          <p>
            Your favourite games, all in one place.
            Pick a game, take your time and enjoy yourself.
          </p>

          <Link href="#games" className="primary-button">
            Explore games <span>→</span>
          </Link>
        </div>

        <div className="welcome-decoration" aria-hidden="true">
          <span>🎯</span>
          <span>🃏</span>
          <span>🔴</span>
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE COLLECTION</span>
            <h2>Choose a game</h2>
            <p>Something for every mood.</p>
          </div>
          <span className="game-count">{games.length} games</span>
        </div>

        <div className="games-grid">
          {games.map((game) => (
            <Link
              href={game.href}
              className="game-card"
              key={game.name}
            >
              <div
                className="game-image"
                style={{ backgroundColor: game.color }}
              >
                <span>{game.icon}</span>
              </div>

              <div className="game-info">
                <span className="game-category">
                  {game.category}
                </span>
                <h3>{game.name}</h3>
                <p>{game.description}</p>

                <div className="play-link">
                  Play game <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <span>❤️</span>
        <div>
          <h2>Made for Keith.</h2>
          <p>
            A personal collection of games to enjoy whenever
            you fancy a game.
          </p>
        </div>
      </section>

      <footer>
        <span>Keith's Games</span>
        <span>Made with care ❤️</span>
      </footer>
    </main>
  );
}
