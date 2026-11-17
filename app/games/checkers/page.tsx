"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Piece = "r" | "R" | "b" | "B" | null;
type Board = Piece[][];

type Move = {
  from: [number, number];
  to: [number, number];
  capture: [number, number] | null;
};

type Difficulty = "easy" | "medium" | "hard";

function createBoard(): Board {
  const board: Board = Array.from(
    { length: 8 },
    () => Array(8).fill(null)
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row][col] = "b";
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row][col] = "r";
    }
  }

  return board;
}

function getDirections(piece: Piece) {
  if (piece === "R" || piece === "B") {
    return [-1, 1];
  }

  return piece === "r" ? [-1] : [1];
}

function getMoves(
  board: Board,
  row: number,
  col: number,
  capturesOnly = false
): Move[] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: Move[] = [];

  for (const direction of getDirections(piece)) {
    for (const side of [-1, 1]) {
      const nextRow = row + direction;
      const nextCol = col + side;

      if (
        nextRow < 0 || nextRow > 7 ||
        nextCol < 0 || nextCol > 7
      ) continue;

      const target = board[nextRow][nextCol];

      if (!target && !capturesOnly) {
        moves.push({
          from: [row, col],
          to: [nextRow, nextCol],
          capture: null
        });
      }

      if (
        target &&
        target.toLowerCase() !== piece.toLowerCase()
      ) {
        const jumpRow = row + direction * 2;
        const jumpCol = col + side * 2;

        if (
          jumpRow >= 0 && jumpRow < 8 &&
          jumpCol >= 0 && jumpCol < 8 &&
          !board[jumpRow][jumpCol]
        ) {
          moves.push({
            from: [row, col],
            to: [jumpRow, jumpCol],
            capture: [nextRow, nextCol]
          });
        }
      }
    }
  }

  return moves;
}

function getAllMoves(board: Board, player: "r" | "b"): Move[] {
  const normalMoves: Move[] = [];
  const captureMoves: Move[] = [];

  board.forEach((line, row) => {
    line.forEach((piece, col) => {
      if (!piece || piece.toLowerCase() !== player) return;

      const moves = getMoves(board, row, col);

      moves.forEach(move => {
        if (move.capture) captureMoves.push(move);
        else normalMoves.push(move);
      });
    });
  });

  return captureMoves.length > 0 ? captureMoves : normalMoves;
}

function applyMove(board: Board, move: Move): Board {
  const next = board.map(row => [...row]);
  let piece = next[move.from[0]][move.from[1]];

  next[move.from[0]][move.from[1]] = null;

  if (move.capture) {
    next[move.capture[0]][move.capture[1]] = null;
  }

  if (piece === "r" && move.to[0] === 0) piece = "R";
  if (piece === "b" && move.to[0] === 7) piece = "B";

  next[move.to[0]][move.to[1]] = piece;

  return next;
}

function chooseComputerMove(
  board: Board,
  difficulty: Difficulty
): Move | null {
  const moves = getAllMoves(board, "b");
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scored = moves.map(move => {
    const next = applyMove(board, move);
    const piece = next[move.to[0]][move.to[1]];

    let score = move.capture ? 10 : 0;

    if (piece === "B" && board[move.from[0]][move.from[1]] !== "B") {
      score += 8;
    }

    score += (move.to[0] - move.from[0]) * 0.5;

    if (difficulty === "hard") {
      score += Math.random() * 0.3;

      const enemyReplies = getAllMoves(next, "r");
      score -= enemyReplies.filter(reply => reply.capture).length * 4;
    }

    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "medium") {
    const bestScore = scored[0].score;
    const choices = scored.filter(item => item.score === bestScore);
    return choices[Math.floor(Math.random() * choices.length)].move;
  }

  return scored[0].move;
}

export default function CheckersPage() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Move[]>([]);
  const [turn, setTurn] = useState<"r" | "b">("r");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [thinking, setThinking] = useState(false);
  const [gameOver, setGameOver] = useState("");
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await loadGameSave("checkers");
        setWins(Number(data.wins) || 0);
        setLosses(Number(data.losses) || 0);
        setDraws(Number(data.draws) || 0);
        if (data.difficulty) setDifficulty(data.difficulty as Difficulty);
      } catch (error) {
        console.error("Could not load checkers saves:", error);
      } finally {
        setLoaded(true);
      }
    }

    loadStats();
  }, []);

  const persistStats = useCallback(
    async (newWins: number, newLosses: number, newDraws: number) => {
      try {
        await saveGame("checkers", {
          wins: newWins,
          losses: newLosses,
          draws: newDraws,
          difficulty
        });
      } catch (error) {
        console.error("Could not save checkers statistics:", error);
      }
    },
    [difficulty]
  );

  const finishGame = useCallback(
    (winner: "r" | "b" | "draw") => {
      if (winner === "r") {
        setGameOver("You won! Well played.");
        setWins(value => {
          const next = value + 1;
          persistStats(next, losses, draws);
          return next;
        });
      } else if (winner === "b") {
        setGameOver("The computer won. Try again!");
        setLosses(value => {
          const next = value + 1;
          persistStats(wins, next, draws);
          return next;
        });
      } else {
        setGameOver("It's a draw!");
        setDraws(value => {
          const next = value + 1;
          persistStats(wins, losses, next);
          return next;
        });
      }
    },
    [wins, losses, draws, persistStats]
  );

  const resetGame = () => {
    setBoard(createBoard());
    setSelected(null);
    setPossibleMoves([]);
    setTurn("r");
    setThinking(false);
    setGameOver("");
  };

  const makeComputerMove = useCallback(
    (currentBoard: Board) => {
      setThinking(true);

      window.setTimeout(() => {
        let nextBoard = currentBoard;
        let move = chooseComputerMove(nextBoard, difficulty);

        if (!move) {
          finishGame("r");
          setThinking(false);
          return;
        }

        nextBoard = applyMove(nextBoard, move);

        if (move.capture) {
          let row = move.to[0];
          let col = move.to[1];

          while (true) {
            const further = getMoves(nextBoard, row, col, true);

            if (further.length === 0) break;

            const continuation =
              further[Math.floor(Math.random() * further.length)];

            nextBoard = applyMove(nextBoard, continuation);
            row = continuation.to[0];
            col = continuation.to[1];
          }
        }

        setBoard(nextBoard);

        const playerMoves = getAllMoves(nextBoard, "r");

        if (playerMoves.length === 0) {
          finishGame("b");
        } else {
          setTurn("r");
        }

        setThinking(false);
      }, 450);
    },
    [difficulty, finishGame]
  );

  const handleSquareClick = (row: number, col: number) => {
    if (turn !== "r" || thinking || gameOver) return;

    const piece = board[row][col];

    if (selected) {
      const move = possibleMoves.find(
        item => item.to[0] === row && item.to[1] === col
      );

      if (move) {
        const nextBoard = applyMove(board, move);
        setBoard(nextBoard);
        setSelected(null);
        setPossibleMoves([]);

        if (move.capture) {
          const nextRow = move.to[0];
          const nextCol = move.to[1];

          const moreCaptures = getMoves(
            nextBoard,
            nextRow,
            nextCol,
            true
          );

          if (moreCaptures.length > 0) {
            setSelected([nextRow, nextCol]);
            setPossibleMoves(moreCaptures);
            return;
          }
        }

        const computerMoves = getAllMoves(nextBoard, "b");

        if (computerMoves.length === 0) {
          finishGame("r");
          return;
        }

        setTurn("b");
        makeComputerMove(nextBoard);
        return;
      }
    }

    if (piece === "r" || piece === "R") {
      const moves = getAllMoves(board, "r").filter(
        item => item.from[0] === row && item.from[1] === col
      );

      if (moves.length > 0) {
        setSelected([row, col]);
        setPossibleMoves(moves);
      }
    } else {
      setSelected(null);
      setPossibleMoves([]);
    }
  };

  const changeDifficulty = (value: Difficulty) => {
    setDifficulty(value);
    saveGame("checkers", { wins, losses, draws, difficulty: value })
      .catch(error => console.error("Could not save difficulty:", error));
  };

  return (
    <main className="checkers-page">
      <header className="checkers-header">
        <Link href="/" className="back-link">← Keith's Games</Link>
        <span className="checkers-brand">♟ Checkers</span>
      </header>

      <section className="checkers-content">
        <div className="checkers-intro">
          <span className="checkers-eyebrow">CLASSIC BOARD GAME</span>
          <h1>Checkers</h1>
          <p>Take your time, plan your moves and beat the computer.</p>
        </div>

        <div className="checkers-layout">
          <div className="board-container">
            <div className="game-status">
              <span className={`status-dot ${turn === "r" ? "red" : "black"}`} />
              {gameOver || (
                thinking
                  ? "Computer is thinking..."
                  : turn === "r"
                    ? "Your turn"
                    : "Computer's turn"
              )}
            </div>

            <div className="checkers-board">
              {board.map((line, row) =>
                line.map((piece, col) => {
                  const dark = (row + col) % 2 === 1;
                  const isSelected =
                    selected?.[0] === row && selected?.[1] === col;
                  const isPossible = possibleMoves.some(
                    move => move.to[0] === row && move.to[1] === col
                  );

                  return (
                    <button
                      key={`${row}-${col}`}
                      className={`square ${dark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isPossible ? "possible" : ""}`}
                      onClick={() => handleSquareClick(row, col)}
                      disabled={!loaded || thinking || !!gameOver}
                      aria-label={`Row ${row + 1}, column ${col + 1}${piece ? `, ${piece === "r" || piece === "R" ? "your" : "computer"} piece` : ""}`}
                    >
                      {piece && (
                        <span className={`checker-piece ${piece.toLowerCase() === "r" ? "red-piece" : "black-piece"}`}>
                          {piece === "R" || piece === "B" ? "♛" : ""}
                        </span>
                      )}
                      {isPossible && <span className="move-indicator" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="board-legend">
              <span><i className="legend-red" /> You</span>
              <span><i className="legend-black" /> Computer</span>
            </div>
          </div>

          <aside className="checkers-sidebar">
            <div className="game-panel">
              <h2>Game settings</h2>
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={event => changeDifficulty(event.target.value as Difficulty)}
                disabled={thinking}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <button className="restart-button" onClick={resetGame}>
                ↻ New game
              </button>
            </div>

            <div className="game-panel">
              <h2>Your statistics</h2>
              <div className="stat-row">
                <span>Games won</span><strong>{wins}</strong>
              </div>
              <div className="stat-row">
                <span>Games lost</span><strong>{losses}</strong>
              </div>
              <div className="stat-row">
                <span>Draws</span><strong>{draws}</strong>
              </div>
              <div className="stat-row total">
                <span>Total games</span>
                <strong>{wins + losses + draws}</strong>
              </div>
            </div>

            <div className="game-panel instructions">
              <h2>How to play</h2>
              <p>1. Click one of your red pieces.</p>
              <p>2. Click a highlighted square to move.</p>
              <p>3. Jump over enemy pieces to capture them.</p>
              <p>4. Reach the opposite end to become a king.</p>
              <p>5. Capture all enemy pieces to win.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
