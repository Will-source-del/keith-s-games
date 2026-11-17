import Link from "next/link";

const games = [
  {
    name: "Slingshot Adventures",
    description: "Launch, aim and knock down the targets.",
    icon: "🐦",
    category: "ARCADE",
    href: "/games/slingshot"
  },
  {
    name: "Checkers",
    description: "Challenge the computer in classic checkers.",
    icon: "🔴",
    category: "STRATEGY",
    href: "/games/checkers"
  },
  {
    name: "Solitaire",
    description: "Relax with a classic card game.",
    icon: "🃏",
    category: "CARD GAME",
    href: "/games/solitaire"
  },
  {
    name: "Sudoku",
    description: "Test your number and logic skills.",
    icon: "🔢",
    category: "PUZZLE",
    href: "/games/sudoku"
  },
  {
    name: "Minesweeper",
    description: "Find the safe squares and avoid the mines.",
    icon: "💣",
    category: "PUZZLE",
    href: "/games/minesweeper"
  },
  {
    name: "Memory Match",
    description: "Find matching pairs of pictures.",
    icon: "🧠",
    category: "BRAIN TRAINING",
    href: "/games/memory"
  }
];

export default function HomePage() {
  return (
    <main className="home">
      <header className="topbar">
        <Link href="/" className="brand">
          🎮 Keith's Games
        </Link>
        <span>Made for Keith ❤️</span>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">YOUR PERSONAL ARCADE</span>
          <h1>Welcome to Keith's Games</h1>
          <p>
            A collection of classic games, puzzles and challenges.
            Pick a game and enjoy yourself.
          </p>
        </div>
      </section>

      <section className="games-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE COLLECTION</span>
            <h2>Choose a game</h2>
          </div>
          <span>{games.length} games available</span>
        </div>

        <div className="games-grid">
          {games.map(game => (
            <Link
              href={game.href}
              className="game-card"
              key={game.name}
            >
              <div className="game-icon">{game.icon}</div>
              <span className="game-category">{game.category}</span>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <span className="play-link">Play game →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2>A little something for everyone</h2>
        <p>
          Enjoy a quick game, challenge yourself or take your time
          with a puzzle. Your games are all in one place.
        </p>
      </section>

      <footer>
        Keith's Games © 2026
      </footer>
    </main>
  );
}
