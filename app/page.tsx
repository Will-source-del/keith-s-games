
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const games = [
  {
    name: "Slingshot Adventures",
    description: "Aim, launch and complete challenges.",
    icon: "🐦",
    category: "ARCADE",
    href: "/games/slingshot",
    accent: "orange",
  },
  {
    name: "Checkers",
    description: "Play against the computer.",
    icon: "🔴",
    category: "STRATEGY",
    href: "/games/checkers",
    accent: "red",
  },
  {
    name: "Solitaire",
    description: "A classic card game.",
    icon: "🃏",
    category: "CARD GAME",
    href: "/games/solitaire",
    accent: "green",
  },
  {
    name: "Sudoku",
    description: "Put your number skills to the test.",
    icon: "🔢",
    category: "PUZZLE",
    href: "/games/sudoku",
    accent: "blue",
  },
  {
    name: "Minesweeper",
    description: "Find the safe squares.",
    icon: "💣",
    category: "PUZZLE",
    href: "/games/minesweeper",
    accent: "purple",
  },
  {
    name: "Memory Match",
    description: "Find all the matching pairs.",
    icon: "🧠",
    category: "BRAIN TRAINING",
    href: "/games/memory",
    accent: "pink",
  },
];

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("Player");
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUser(data.user);

        const { data: profile } = await supabase
          .from("player_profiles")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();

        setUsername(
          profile?.username ||
            data.user.user_metadata?.username ||
            "Player"
        );

        const { data: owner } = await supabase
          .from("game_owners")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        setIsOwner(!!owner);
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setIsOwner(false);
    setUsername("Player");
  }

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

          {user && (
            <Link href="/account" className="sidebar-link">
              <span>👤</span>
              My Account
            </Link>
          )}

          {isOwner && (
            <Link href="/owner" className="sidebar-link">
              <span>🛡️</span>
              Owner Panel
            </Link>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user-icon">
            {loading ? "…" : username.charAt(0).toUpperCase()}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{loading ? "Loading..." : username}</strong>
            <span>{user ? "Signed in" : "Guest player"}</span>
          </div>

          {user ? (
            <button
              onClick={signOut}
              title="Sign out"
              style={smallButton}
            >
              ↪
            </button>
          ) : (
            <Link href="/login" style={smallButton}>
              →
            </Link>
          )}
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div>
            <span className="app-date-label">YOUR GAME LIBRARY</span>
            <h1>
              Welcome{user ? ` back, ${username}` : " to Keith's Games"}
            </h1>
          </div>

          {user ? (
            <Link href="/account" className="app-player-badge">
              <span>●</span> My Account
            </Link>
          ) : (
            <Link href="/login" className="app-player-badge">
              Sign in / Register →
            </Link>
          )}
        </header>

        <section className="app-feature">
          <div className="app-feature-content">
            <span className="app-feature-label">
              YOUR PERSONAL ARCADE
            </span>
            <h2>What would you like to play?</h2>
            <p>
              {user
                ? "Your account is ready. Choose a game and keep playing."
                : "Create an account to save your progress and coins."}
            </p>

            <a href="#games" className="app-feature-button">
              Browse games <span>→</span>
            </a>

            {!user && (
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  marginLeft: 16,
                  color: "white",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Create account
              </Link>
            )}
          </div>

          <div className="app-feature-art">🎮</div>
        </section>

        <section className="app-games-section" id="games">
          <div className="app-section-heading">
            <div>
              <span className="app-section-label">THE COLLECTION</span>
              <h2>All games</h2>
            </div>

            <span className="app-game-count">
              {games.length} games
            </span>
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

                <span className="app-game-category">
                  {game.category}
                </span>

                <h3>{game.name}</h3>
                <p>{game.description}</p>

                <span className="app-play-link">
                  Play now <span>→</span>
                </span>
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

const smallButton: React.CSSProperties = {
  color: "#c5b5ff",
  background: "#29233f",
  border: "1px solid #40345f",
  borderRadius: 8,
  padding: "7px 10px",
  textDecoration: "none",
  cursor: "pointer",
  fontWeight: 800,
};
