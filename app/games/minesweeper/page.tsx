"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Difficulty = "easy" | "medium" | "hard";

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

const settings = {
  easy: { rows: 8, columns: 8, mines: 10 },
  medium: { rows: 12, columns: 12, mines: 25 },
  hard: { rows: 16, columns: 16, mines: 45 }
};

function createBoard(level: Difficulty): Cell[][] {
  const { rows, columns, mines } = settings[level];

  const board: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0
    }))
  );

  let placed = 0;

  while (placed < mines) {
    const row = Math.floor(Math.random() * rows);
    const column = Math.floor(Math.random() * columns);

    if (!board[row][column].mine) {
      board[row][column].mine = true;
      placed++;
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (board[row][column].mine) continue;

      let count = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = column + dc;

          if (
            r >= 0 &&
            r < rows &&
            c >= 0 &&
            c < columns &&
            board[r][c].mine
          ) {
            count++;
          }
        }
      }

      board[row][column].adjacent = count;
    }
  }

  return board;
}

export default function MinesweeperPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<Cell[][]>(() => createBoard("easy"));
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [flags, setFlags] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<Record<string, number>>({});
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await loadGameSave("minesweeper");
        setBestTime(
          data.bestTime && typeof data.bestTime === "object"
            ? data.bestTime as Record<string, number>
            : {}
        );
        setGamesPlayed(Number(data.gamesPlayed) || 0);
      } catch (error) {
        console.error("Could not load Minesweeper saves:", error);
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
    setBoard(createBoard(level));
    setStarted(false);
    setFinished(false);
    setWon(false);
    setFlags(0);
    setSeconds(0);
  }

  async function finishGame(winning: boolean, finalTime: number) {
    setFinished(true);
    setWon(winning);

    const nextGames = gamesPlayed + 1;
    const nextBest = { ...bestTime };

    if (
      winning &&
      (!nextBest[difficulty] || finalTime < nextBest[difficulty])
    ) {
      nextBest[difficulty] = finalTime;
    }

    setGamesPlayed(nextGames);
    setBestTime(nextBest);

    try {
      await saveGame("minesweeper", {
        bestTime: nextBest,
        gamesPlayed: nextGames
      });
    } catch (error) {
      console.error("Could not save Minesweeper statistics:", error);
    }
  }

  function revealCell(row: number, column: number) {
    if (!loaded || finished) return;

    const selected = board[row][column];

    if (selected.revealed || selected.flagged) return;

    if (!started) setStarted(true);

    const nextBoard = board.map(line => line.map(cell => ({ ...cell })));

    if (selected.mine) {
      nextBoard[row][column].revealed = true;

      nextBoard.forEach(line =>
        line.forEach(cell => {
          if (cell.mine) cell.revealed = true;
        })
      );

      setBoard(nextBoard);
      finishGame(false, seconds);
      return;
    }

    const revealEmpty = (r: number, c: number) => {
      if (
        r < 0 ||
        r >= nextBoard.length ||
        c < 0 ||
        c >= nextBoard[0].length
      ) {
        return;
      }

      const cell = nextBoard[r][c];

      if (cell.revealed || cell.flagged || cell.mine) return;

      cell.revealed = true;

      if (cell.adjacent === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) {
              revealEmpty(r + dr, c + dc);
            }
          }
        }
      }
    };

    revealEmpty(row, column);
    setBoard(nextBoard);

    const safeCells = nextBoard.flat().filter(cell => !cell.mine);
    const revealedSafeCells = safeCells.filter(cell => cell.revealed);

    if (revealedSafeCells.length === safeCells.length) {
      finishGame(true, seconds);
    }
  }

  function toggleFlag(
    event: React.MouseEvent<HTMLButtonElement>,
    row: number,
    column: number
  ) {
    event.preventDefault();

    if (!loaded || finished) return;

    const selected = board[row][column];

    if (selected.revealed) return;

    const nextBoard = board.map(line => line.map(cell => ({ ...cell })));
    const nextFlagged = !selected.flagged;

    nextBoard[row][column].flagged = nextFlagged;

    setBoard(nextBoard);
    setFlags(value => value + (nextFlagged ? 1 : -1));
  }

  function formatTime(value: number) {
    const minutes = Math.floor(value / 60);
    const remaining = value % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  const mineCount = settings[difficulty].mines;

  return (
    <main className="minesweeper-page">
      <header className="minesweeper-header">
        <Link href="/" className="back-link">
          ← Keith's Games
        </Link>
        <span className="minesweeper-brand">💣 Minesweeper</span>
      </header>

      <section className="minesweeper-content">
        <div className="minesweeper-intro">
          <span className="minesweeper-eyebrow">THINK CAREFULLY</span>
          <h1>Minesweeper</h1>
          <p>Find every safe square without hitting a mine.</p>
        </div>

        <div className="minesweeper-layout">
          <div className="minesweeper-main">
            <div className="minesweeper-toolbar">
              <div>
                <span>💣 Mines</span>
                <strong>{mineCount - flags}</strong>
              </div>
              <div>
                <span>⏱ Time</span>
                <strong>{formatTime(seconds)}</strong>
              </div>
              <div>
                <span>🚩 Flags</span>
                <strong>{flags}</strong>
              </div>
            </div>

            <div className={`minesweeper-board minesweeper-${difficulty}`}>
              {board.map((line, row) =>
                line.map((cell, column) => (
                  <button
                    key={`${row}-${column}`}
                    className={`mine-cell ${cell.revealed ? "revealed" : ""} ${cell.mine && cell.revealed ? "mine-hit" : ""}`}
                    onClick={() => revealCell(row, column)}
                    onContextMenu={event =>
                      toggleFlag(event, row, column)
                    }
                    disabled={!loaded || finished || cell.revealed}
                    aria-label={
                      cell.revealed
                        ? cell.mine
                          ? "Mine"
                          : `Revealed square ${cell.adjacent}`
                        : cell.flagged
                          ? "Flagged square"
                          : "Hidden square"
                    }
                  >
                    {cell.revealed
                      ? cell.mine
                        ? "💣"
                        : cell.adjacent || ""
                      : cell.flagged
                        ? "🚩"
                        : ""}
                  </button>
                ))
              )}
            </div>

            {finished && (
              <div className={`minesweeper-result ${won ? "won" : "lost"}`}>
                <h2>{won ? "🏆 You cleared the board!" : "💥 Game over!"}</h2>
                <p>
                  {won
                    ? `You completed the game in ${formatTime(seconds)}.`
                    : "You hit a mine. Try again."}
                </p>
                <button onClick={() => restartGame()}>
                  Play again
                </button>
              </div>
            )}
          </div>

          <aside className="minesweeper-sidebar">
            <div className="minesweeper-panel">
              <h2>Difficulty</h2>

              <div className="minesweeper-levels">
                {(["easy", "medium", "hard"] as Difficulty[]).map(level => (
                  <button
                    key={level}
                    className={difficulty === level ? "active" : ""}
                    onClick={() => restartGame(level)}
                    disabled={!loaded}
                  >
                    <strong>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </strong>
                    <small>
                      {settings[level].rows} × {settings[level].columns}
                    </small>
                  </button>
                ))}
              </div>

              <button
                className="minesweeper-restart"
                onClick={() => restartGame()}
                disabled={!loaded}
              >
                ↻ New game
              </button>
            </div>

            <div className="minesweeper-panel">
              <h2>Your statistics</h2>
              <div className="minesweeper-stat">
                <span>Games played</span>
                <strong>{gamesPlayed}</strong>
              </div>
              <div className="minesweeper-stat">
                <span>Best easy time</span>
                <strong>
                  {bestTime.easy ? formatTime(bestTime.easy) : "—"}
                </strong>
              </div>
              <div className="minesweeper-stat">
                <span>Best medium time</span>
                <strong>
                  {bestTime.medium ? formatTime(bestTime.medium) : "—"}
                </strong>
              </div>
              <div className="minesweeper-stat">
                <span>Best hard time</span>
                <strong>
                  {bestTime.hard ? formatTime(bestTime.hard) : "—"}
                </strong>
              </div>
            </div>

            <div className="minesweeper-panel">
              <h2>How to play</h2>
              <p>1. Click a square to reveal it.</p>
              <p>2. Numbers show how many nearby mines there are.</p>
              <p>3. Right-click to place or remove a flag.</p>
              <p>4. Reveal every safe square to win.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
