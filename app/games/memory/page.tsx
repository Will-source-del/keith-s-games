"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadGameSave, saveGame } from "@/lib/game-saves";

const symbols = [
  "🍎", "🍋", "🍇", "🍓", "🍒", "🍉",
  "🍊", "🍍", "🥝", "🍑", "🥥", "🫐"
];

type Card = {
  id: number;
  symbol: string;
  matched: boolean;
};

type Difficulty = "easy" | "medium" | "hard";

function createDeck(difficulty: Difficulty): Card[] {
  const pairs = difficulty === "easy" ? 6 : difficulty === "medium" ? 8 : 12;

  const selected = symbols.slice(0, pairs);
  const deck = [...selected, ...selected]
    .map((symbol, index) => ({
      id: index,
      symbol,
      matched: false
    }))
    .sort(() => Math.random() - 0.5);

  return deck;
}

export default function MemoryPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [cards, setCards] = useState<Card[]>(() => createDeck("easy"));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const totalPairs = cards.length / 2;

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await loadGameSave("memory");

        setBestScore(Number(data.bestScore) || 0);
        setGamesPlayed(Number(data.gamesPlayed) || 0);
      } catch (error) {
        console.error("Could not load memory saves:", error);
      } finally {
        setLoaded(true);
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    if (!started || finished) return;

    const timer = window.setInterval(() => {
      setSeconds(value => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started, finished]);

  function restartGame(level: Difficulty = difficulty) {
    setDifficulty(level);
    setCards(createDeck(level));
    setFlipped([]);
    setMoves(0);
    setMatches(0);
    setSeconds(0);
    setStarted(false);
    setFinished(false);
  }

  async function completeGame(finalMoves: number) {
    setFinished(true);

    const nextBest =
      bestScore === 0 || finalMoves < bestScore
        ? finalMoves
        : bestScore;

    const nextGames = gamesPlayed + 1;

    setBestScore(nextBest);
    setGamesPlayed(nextGames);

    try {
      await saveGame("memory", {
        bestScore: nextBest,
        gamesPlayed: nextGames,
        lastMoves: finalMoves
      });
    } catch (error) {
      console.error("Could not save memory statistics:", error);
    }
  }

  function handleCardClick(index: number) {
    if (
      !loaded ||
      finished ||
      flipped.includes(index) ||
      cards[index].matched ||
      flipped.length === 2
    ) {
      return;
    }

    if (!started) setStarted(true);

    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const [first, second] = nextFlipped;
      const nextMoves = moves + 1;

      setMoves(nextMoves);

      if (cards[first].symbol === cards[second].symbol) {
        const nextCards = cards.map((card, i) =>
          i === first || i === second
            ? { ...card, matched: true }
            : card
        );

        setCards(nextCards);
        setMatches(value => value + 1);
        setFlipped([]);

        if (nextCards.every(card => card.matched)) {
          completeGame(nextMoves);
        }
      } else {
        window.setTimeout(() => {
          setFlipped([]);
        }, 900);
      }
    }
  }

  function formatTime(value: number) {
    const minutes = Math.floor(value / 60);
    const remaining = value % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  return (
    <main className="memory-page">
      <header className="memory-header">
        <Link href="/" className="back-link">
          ← Keith's Games
        </Link>
        <span className="memory-brand">🧠 Memory Match</span>
      </header>

      <section className="memory-content">
        <div className="memory-intro">
          <span className="memory-eyebrow">BRAIN TRAINING</span>
          <h1>Memory Match</h1>
          <p>Find the matching pairs. How good is your memory?</p>
        </div>

        <div className="memory-layout">
          <div className="memory-main">
            <div className="memory-toolbar">
              <div>
                <span>Moves</span>
                <strong>{moves}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{formatTime(seconds)}</strong>
              </div>
              <div>
                <span>Matches</span>
                <strong>{matches}/{totalPairs}</strong>
              </div>
            </div>

            <div className={`memory-grid ${cards.length === 24 ? "memory-hard" : ""}`}>
              {cards.map((card, index) => {
                const isFlipped =
                  flipped.includes(index) || card.matched;

                return (
                  <button
                    key={card.id}
                    className={`memory-card ${isFlipped ? "revealed" : ""} ${card.matched ? "matched" : ""}`}
                    onClick={() => handleCardClick(index)}
                    disabled={!loaded || card.matched || flipped.includes(index) || finished}
                    aria-label={isFlipped ? card.symbol : "Hidden card"}
                  >
                    <span className="memory-card-inner">
                      <span className="memory-card-front">?</span>
                      <span className="memory-card-back">{card.symbol}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {finished && (
              <div className="memory-result">
                <span>🏆</span>
                <h2>Well done!</h2>
                <p>You found every pair in {moves} moves.</p>
                <p>Time: {formatTime(seconds)}</p>
                <button onClick={() => restartGame()}>
                  Play again
                </button>
              </div>
            )}
          </div>

          <aside className="memory-sidebar">
            <div className="memory-panel">
              <h2>Difficulty</h2>

              <div className="difficulty-options">
                {(["easy", "medium", "hard"] as Difficulty[]).map(level => (
                  <button
                    key={level}
                    className={difficulty === level ? "active" : ""}
                    onClick={() => restartGame(level)}
                    disabled={!loaded}
                  >
                    <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                    <small>
                      {level === "easy" ? "6 pairs" : level === "medium" ? "8 pairs" : "12 pairs"}
                    </small>
                  </button>
                ))}
              </div>

              <button
                className="memory-restart"
                onClick={() => restartGame()}
                disabled={!loaded}
              >
                ↻ New game
              </button>
            </div>

            <div className="memory-panel">
              <h2>Your statistics</h2>

              <div className="memory-stat">
                <span>Games played</span>
                <strong>{gamesPlayed}</strong>
              </div>

              <div className="memory-stat">
                <span>Best moves</span>
                <strong>{bestScore || "—"}</strong>
              </div>
            </div>

            <div className="memory-panel">
              <h2>How to play</h2>
              <p>1. Click any card to reveal it.</p>
              <p>2. Find another card with the same picture.</p>
              <p>3. Matching cards stay revealed.</p>
              <p>4. Find every pair to win.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
