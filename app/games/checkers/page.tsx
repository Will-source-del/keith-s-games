"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Piece = "r" | "R" | "b" | "B" | null;
type Board = Piece[][];
type Difficulty = "easy" | "medium" | "hard";

type Move = {
  from: [number, number];
  to: [number, number];
  capture: [number, number] | null;
};

function createBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));

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

function getDirections(piece: Piece): number[] {
  if (piece === "R" || piece === "B") return [-1, 1];
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

      if (nextRow < 0 || nextRow > 7 || nextCol < 0 || nextCol > 7) continue;

      const target = board[nextRow][nextCol];

      if (!target && !capturesOnly) {
        moves.push({
          from: [row, col],
          to: [nextRow, nextCol],
          capture: null,
        });
      }

      if (target && target.toLowerCase() !== piece.toLowerCase()) {
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
            capture: [nextRow, nextCol],
          });
        }
      }
    }
  }

  return moves;
}

function getAllMoves(board: Board, player: "r" | "b"): Move[] {
  const normal: Move[] = [];
  const captures: Move[] = [];

  board.forEach((line, row) => {
    line.forEach((piece, col) => {
      if (!piece || piece.toLowerCase() !== player) return;

      getMoves(board, row, col).forEach((move) => {
        if (move.capture) captures.push(move);
        else normal.push(move);
      });
    });
  });

  return captures.length > 0 ? captures : normal;
}

function applyMove(board: Board, move: Move): Board {
  const next = board.map((row) => [...row]);
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

function chooseComputerMove(board: Board, difficulty: Difficulty): Move | null {
  const moves = getAllMoves(board, "b");
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scored = moves.map((move) => {
    const next = applyMove(board, move);
    const piece = next[move.to[0]][move.to[1]];

    let score = move.capture ? 10 : 0;

    if (piece === "B" && board[move.from[0]][move.from[1]] !== "B") {
      score += 8;
    }

    score += (move.to[0] - move.from[0]) * 0.5;

    if (difficulty === "hard") {
      const replies = getAllMoves(next, "r");
      score -= replies.filter((reply) => reply.capture).length * 4;
      score += Math.random() * 0.3;
    }

    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "medium") {
    const best = scored[0].score;
    const choices = scored.filter((item) => item.score === best);
    return choices[Math.floor(Math.random() * choices.length)].move;
  }

  return scored[0].move;
}

function countPieces(board: Board, player: "r" | "b") {
  return board.flat().filter(
    (piece) => piece && piece.toLowerCase() === player
  ).length;
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
  const [moveCount, setMoveCount] = useState(0);

  const playerPieces = countPieces(board, "r");
  const computerPieces = countPieces(board, "b");
  const forcedChain = selected !== null && possibleMoves.some((move) => move.capture);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const data = await loadGameSave("checkers");
        if (!active) return;

        setWins(Number(data.wins) || 0);
        setLosses(Number(data.losses) || 0);
        setDraws(Number(data.draws) || 0);

        if (["easy", "medium", "hard"].includes(String(data.difficulty))) {
          setDifficulty(data.difficulty as Difficulty);
        }
      } catch (error) {
        console.error("Could not load checkers saves:", error);
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, []);

  const persistStats = useCallback(
    async (newWins: number, newLosses: number, newDraws: number) => {
      try {
        await saveGame("checkers", {
          wins: newWins,
          losses: newLosses,
          draws: newDraws,
          difficulty,
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
        setGameOver("You won! Excellent game.");
        setWins((value) => {
          const next = value + 1;
          persistStats(next, losses, draws);
          return next;
        });
      } else if (winner === "b") {
        setGameOver("The computer won. Try another game!");
        setLosses((value) => {
          const next = value + 1;
          persistStats(wins, next, draws);
          return next;
        });
      } else {
        setGameOver("It's a draw!");
        setDraws((value) => {
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
    setMoveCount(0);
  };

  const makeComputerMove = useCallback(
    (currentBoard: Board) => {
      setThinking(true);

      window.setTimeout(() => {
        let nextBoard = currentBoard;
        const move = chooseComputerMove(nextBoard, difficulty);

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

            const continuation = further[Math.floor(Math.random() * further.length)];
            nextBoard = applyMove(nextBoard, continuation);
            row = continuation.to[0];
            col = continuation.to[1];
          }
        }

        setBoard(nextBoard);
        setMoveCount((value) => value + 1);

        if (getAllMoves(nextBoard, "r").length === 0) {
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
    if (!loaded || turn !== "r" || thinking || gameOver) return;

    const piece = board[row][col];

    if (selected) {
      const move = possibleMoves.find(
        (item) => item.to[0] === row && item.to[1] === col
      );

      if (move) {
        const nextBoard = applyMove(board, move);
        setBoard(nextBoard);
        setMoveCount((value) => value + 1);
        setSelected(null);
        setPossibleMoves([]);

        if (move.capture) {
          const moreCaptures = getMoves(nextBoard, move.to[0], move.to[1], true);

          if (moreCaptures.length > 0) {
            setSelected(move.to);
            setPossibleMoves(moreCaptures);
            return;
          }
        }

        if (getAllMoves(nextBoard, "b").length === 0) {
          finishGame("r");
          return;
        }

        setTurn("b");
        makeComputerMove(nextBoard);
        return;
      }
    }

    if (forcedChain) return;

    if (piece === "r" || piece === "R") {
      const moves = getAllMoves(board, "r").filter(
        (item) => item.from[0] === row && item.from[1] === col
      );

      if (moves.length > 0) {
        setSelected([row, col]);
        setPossibleMoves(moves);
      } else {
        setSelected(null);
        setPossibleMoves([]);
      }
    } else {
      setSelected(null);
      setPossibleMoves([]);
    }
  };

  const changeDifficulty = (value: Difficulty) => {
    setDifficulty(value);
    saveGame("checkers", {
      wins,
      losses,
      draws,
      difficulty: value,
    }).catch((error) => console.error("Could not save difficulty:", error));
  };

  if (!loaded) {
    return (
      <main className="loading">
        <span>♟</span>
        <h1>Loading Checkers</h1>
        <p>Getting your game ready...</p>
        <style jsx>{`
          .loading {
            min-height: 100vh;
            display: grid;
            place-content: center;
            text-align: center;
            background: #101521;
            color: white;
            font-family: Arial, sans-serif;
          }
          .loading span { font-size: 48px; color: #f87171; }
          .loading p { color: #929db0; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">🎮</span>
          <span>Keith&apos;s Games</span>
        </Link>

        <div className="nav-label">GAME</div>
        <Link href="/" className="nav-link">⌂ <span>Game library</span></Link>
        <div className="nav-link active">♟ <span>Checkers</span></div>

        <div className="sidebar-player">
          <div className="avatar">K</div>
          <div><strong>Keith</strong><small>Player</small></div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">STRATEGY GAME</div>
            <h1>Checkers</h1>
          </div>
          <div className="topbar-actions">
            <span className={`turn-pill ${turn === "r" ? "your-turn" : "computer-turn"}`}>
              <i /> {gameOver || (thinking ? "Computer thinking..." : turn === "r" ? "Your turn" : "Computer's turn")}
            </span>
            <button className="new-game" onClick={resetGame}>↻ New game</button>
          </div>
        </header>

        <div className="stats">
          <div className="stat-card">
            <span className="stat-icon green">🏆</span>
            <div><strong>{wins}</strong><small>Games won</small></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon red">✕</span>
            <div><strong>{losses}</strong><small>Games lost</small></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon blue">＝</span>
            <div><strong>{draws}</strong><small>Draws</small></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon purple">♟</span>
            <div><strong>{moveCount}</strong><small>Moves this game</small></div>
          </div>
        </div>

        <div className="game-layout">
          <section className="board-panel">
            <div className="board-heading">
              <div>
                <h2>Game board</h2>
                <p>Select a red piece to see its legal moves.</p>
              </div>
              <span className="board-counter">{playerPieces} vs {computerPieces}</span>
            </div>

            <div className="player-strip">
              <div className="player-token red-token" />
              <div><strong>You</strong><small>{playerPieces} pieces remaining</small></div>
              <span className="player-label">PLAYER</span>
            </div>

            <div className="board-wrap">
              <div className="board">
                {board.map((line, row) =>
                  line.map((piece, col) => {
                    const dark = (row + col) % 2 === 1;
                    const isSelected = selected?.[0] === row && selected?.[1] === col;
                    const isPossible = possibleMoves.some(
                      (move) => move.to[0] === row && move.to[1] === col
                    );

                    return (
                      <button
                        key={`${row}-${col}`}
                        className={`square ${dark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isPossible ? "possible" : ""}`}
                        onClick={() => handleSquareClick(row, col)}
                        disabled={thinking || !!gameOver}
                        aria-label={`Row ${row + 1}, column ${col + 1}`}
                      >
                        {piece && (
                          <span className={`piece ${piece.toLowerCase() === "r" ? "red-piece" : "black-piece"}`}>
                            {(piece === "R" || piece === "B") && <span className="crown">♛</span>}
                          </span>
                        )}
                        {isPossible && <span className="move-dot" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="player-strip opponent">
              <div className="player-token black-token" />
              <div><strong>Computer</strong><small>{computerPieces} pieces remaining</small></div>
              <span className="player-label">OPPONENT</span>
            </div>

            {gameOver && (
              <div className="result">
                <div className="result-icon">{gameOver.startsWith("You won") ? "🏆" : "♟"}</div>
                <div><strong>{gameOver}</strong><small>Start another game whenever you're ready.</small></div>
                <button onClick={resetGame}>Play again</button>
              </div>
            )}
          </section>

          <aside className="right-column">
            <section className="panel">
              <div className="panel-title"><span>⚙️</span><h2>Game settings</h2></div>
              <label htmlFor="difficulty">Computer difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(event) => changeDifficulty(event.target.value as Difficulty)}
                disabled={thinking}
              >
                <option value="easy">Easy — relaxed</option>
                <option value="medium">Medium — balanced</option>
                <option value="hard">Hard — challenging</option>
              </select>
              <div className="difficulty-note">
                {difficulty === "easy"
                  ? "The computer chooses moves more randomly."
                  : difficulty === "medium"
                    ? "The computer prefers captures and promotions."
                    : "The computer also considers your possible captures."}
              </div>
              <button className="restart" onClick={resetGame}>↻ Restart game</button>
            </section>

            <section className="panel">
              <div className="panel-title"><span>📖</span><h2>How to play</h2></div>
              <ol className="instructions">
                <li>Select one of your red pieces.</li>
                <li>Choose a highlighted square to move.</li>
                <li>Jump over computer pieces to capture them.</li>
                <li>Captures are compulsory. Continue a multi-jump when available.</li>
                <li>Reach the far side to become a king.</li>
                <li>Win by capturing or blocking every computer piece.</li>
              </ol>
            </section>

            <section className="tip-card">
              <span>💡</span>
              <div><strong>Strategy tip</strong><p>Protect your back row to stop the computer from crowning its pieces.</p></div>
            </section>
          </aside>
        </div>

        <footer className="footer">
          <span>Keith&apos;s Games</span>
          <span>Checkers · Play at your own pace</span>
        </footer>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .app {
          min-height: 100vh;
          display: flex;
          background: #101521;
          color: #f4f6fb;
          font-family: Arial, Helvetica, sans-serif;
        }
        button, select { font: inherit; }
        button { cursor: pointer; }
        .sidebar {
          width: 235px;
          flex-shrink: 0;
          min-height: 100vh;
          height: 100vh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          padding: 25px 17px;
          background: #171e2c;
          border-right: 1px solid #293246;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          margin: 0 4px 55px;
          color: white;
          text-decoration: none;
          font-size: 16px;
          font-weight: 800;
        }
        .brand-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          background: #6553bb;
          border-radius: 12px;
          font-size: 20px;
        }
        .nav-label, .eyebrow {
          color: #8290a7;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .nav-label { margin: 0 10px 13px; }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 12px;
          margin-bottom: 5px;
          border-radius: 9px;
          color: #aeb9cc;
          text-decoration: none;
          font-size: 14px;
        }
        .nav-link.active { background: #2b2a45; color: white; }
        .sidebar-player {
          margin-top: auto;
          padding: 18px 4px 0;
          border-top: 1px solid #303a4d;
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .avatar {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          background: #3d806d;
          border-radius: 50%;
          font-weight: 800;
        }
        .sidebar-player strong, .sidebar-player small { display: block; }
        .sidebar-player strong { font-size: 13px; }
        .sidebar-player small { color: #8d9ab0; margin-top: 4px; font-size: 11px; }
        .main { flex: 1; min-width: 0; padding: 28px 34px 20px; }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 24px;
        }
        h1 { font-size: 25px; margin: 7px 0 0; letter-spacing: -.6px; }
        h2 { font-size: 16px; margin: 0; }
        p { margin: 0; }
        .topbar-actions { display: flex; align-items: center; gap: 12px; }
        .turn-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #344255;
          border-radius: 30px;
          padding: 9px 13px;
          color: #cbd4e2;
          font-size: 11px;
          background: #1a2332;
        }
        .turn-pill i { width: 7px; height: 7px; border-radius: 50%; background: #f87171; }
        .turn-pill.computer-turn i { background: #aab2c1; }
        .new-game, .restart {
          border: 0;
          border-radius: 9px;
          background: #7563d7;
          color: white;
          font-weight: 700;
          padding: 11px 15px;
          font-size: 12px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
          margin-bottom: 20px;
        }
        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid #2b3548;
          border-radius: 12px;
          background: #192231;
        }
        .stat-icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 10px;
          font-weight: 800;
        }
        .stat-icon.green { background: #203d35; color: #83d6ae; }
        .stat-icon.red { background: #422a32; color: #ff9c9c; }
        .stat-icon.blue { background: #26384d; color: #8dc7f5; }
        .stat-icon.purple { background: #352d50; color: #c2aaff; }
        .stat-card strong, .stat-card small { display: block; }
        .stat-card strong { font-size: 20px; }
        .stat-card small { margin-top: 4px; color: #929fb3; font-size: 10px; }
        .game-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 285px;
          gap: 18px;
          align-items: start;
        }
        .board-panel, .panel {
          border: 1px solid #2b3548;
          border-radius: 14px;
          background: #192231;
        }
        .board-panel { padding: 20px; }
        .board-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 17px;
        }
        .board-heading p { margin-top: 5px; color: #929fb3; font-size: 11px; }
        .board-counter {
          padding: 8px 11px;
          border-radius: 8px;
          background: #242e40;
          color: #d9e0eb;
          font-size: 11px;
          font-weight: 700;
        }
        .player-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid #303b4f;
          border-radius: 9px;
          background: #202b3c;
        }
        .player-strip strong, .player-strip small { display: block; }
        .player-strip strong { font-size: 12px; }
        .player-strip small { color: #97a4b8; font-size: 10px; margin-top: 3px; }
        .player-token { width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 -3px 4px #0005, 0 2px 3px #0005; }
        .red-token { background: #e65e63; }
        .black-token { background: #252a35; border: 1px solid #687184; }
        .player-label { margin-left: auto; color: #8593a9; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
        .board-wrap { padding: 12px 0; }
        .board {
          width: min(100%, 620px);
          margin: auto;
          aspect-ratio: 1;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          border: 7px solid #9b704d;
          border-radius: 5px;
          overflow: hidden;
          box-shadow: 0 9px 25px #0004;
        }
        .square {
          position: relative;
          min-width: 0;
          border: 0;
          display: grid;
          place-items: center;
          padding: 0;
        }
        .square.light { background: #e9d5b5; }
        .square.dark { background: #81583f; }
        .square.selected { box-shadow: inset 0 0 0 4px #f5d76e; }
        .square.possible { box-shadow: inset 0 0 0 3px #a7e7a4; }
        .square:focus-visible { outline: 3px solid #fff; outline-offset: -4px; z-index: 2; }
        .piece {
          width: 76%;
          height: 76%;
          border-radius: 50%;
          display: grid;
          place-items: center;
          position: relative;
          box-shadow: inset 0 -6px 0 #0003, inset 0 3px 3px #ffffff45, 0 3px 5px #0006;
        }
        .red-piece { background: radial-gradient(circle at 35% 25%, #ff9a9d, #d83e4c 70%); border: 2px solid #a92e3c; }
        .black-piece { background: radial-gradient(circle at 35% 25%, #727d8d, #252b38 70%); border: 2px solid #161b25; }
        .crown { color: #ffe28a; font-size: clamp(13px, 3vw, 27px); text-shadow: 0 2px 3px #000; }
        .move-dot { position: absolute; width: 22%; height: 22%; border-radius: 50%; background: #a7e7a4; box-shadow: 0 0 0 3px #ffffff50; }
        .opponent { margin-top: 0; }
        .right-column { display: grid; gap: 14px; }
        .panel { padding: 17px; }
        .panel-title { display: flex; align-items: center; gap: 9px; margin-bottom: 17px; }
        .panel-title span { font-size: 17px; }
        .panel label { display: block; color: #a9b4c7; font-size: 11px; margin-bottom: 7px; }
        .panel select {
          width: 100%;
          padding: 11px;
          border: 1px solid #3a465a;
          border-radius: 8px;
          background: #111a28;
          color: white;
          font-size: 12px;
        }
        .difficulty-note { min-height: 34px; color: #8f9cb1; font-size: 10px; line-height: 1.5; margin: 10px 0 13px; }
        .restart { width: 100%; background: #303b50; }
        .instructions { margin: 0; padding-left: 19px; color: #aab5c8; font-size: 11px; line-height: 1.8; }
        .instructions li { padding-left: 3px; margin-bottom: 5px; }
        .tip-card {
          display: flex;
          gap: 10px;
          padding: 14px;
          border: 1px solid #55472c;
          border-radius: 11px;
          background: #2b271e;
          color: #f3d38a;
        }
        .tip-card > span { font-size: 19px; }
        .tip-card strong { font-size: 11px; }
        .tip-card p { margin-top: 5px; color: #c3b99f; font-size: 10px; line-height: 1.5; }
        .result {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          margin-top: 15px;
          border: 1px solid #5a795f;
          border-radius: 10px;
          background: #20372d;
        }
        .result-icon { font-size: 27px; }
        .result strong, .result small { display: block; }
        .result strong { font-size: 12px; }
        .result small { margin-top: 4px; color: #a8c4b1; font-size: 10px; }
        .result button {
          margin-left: auto;
          border: 0;
          border-radius: 7px;
          padding: 9px 12px;
          background: #70bd8d;
          color: #10251a;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 30px;
          padding-top: 16px;
          border-top: 1px solid #293448;
          color: #7f8ba0;
          font-size: 10px;
        }
        @media (max-width: 1050px) {
          .game-layout { grid-template-columns: minmax(0, 1fr) 250px; }
          .main { padding: 24px 20px; }
          .sidebar { width: 205px; }
          .stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 760px) {
          .sidebar { width: 65px; padding: 18px 8px; }
          .brand { justify-content: center; margin: 0 0 35px; }
          .brand > span:last-child, .nav-label, .nav-link span, .sidebar-player > div:last-child { display: none; }
          .nav-link { justify-content: center; padding: 13px 5px; font-size: 18px; }
          .sidebar-player { justify-content: center; }
          .game-layout { grid-template-columns: 1fr; }
          .right-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .tip-card { grid-column: 1 / -1; }
        }
        @media (max-width: 520px) {
          .main { padding: 18px 12px; }
          .topbar { align-items: flex-start; flex-direction: column; }
          .topbar-actions { width: 100%; justify-content: space-between; }
          .stats { gap: 8px; }
          .stat-card { padding: 10px; gap: 8px; }
          .stat-card strong { font-size: 17px; }
          .stat-card small { font-size: 9px; }
          .stat-icon { width: 30px; height: 30px; }
          .board-panel { padding: 10px; }
          .board { border-width: 4px; }
          .right-column { grid-template-columns: 1fr; }
          .footer { flex-direction: column; }
          .result { flex-wrap: wrap; }
          .result button { margin-left: 0; }
        }
      `}</style>
    </main>
  );
}
