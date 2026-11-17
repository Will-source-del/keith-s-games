"use client";

import { useState } from "react";
import Link from "next/link";

type Difficulty = "easy" | "medium" | "hard";

const puzzles: Record<Difficulty, string> = {
  easy: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  medium: "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
  hard: "000000907000420180000705026100904000050000040000507009920108000034059000507000000"
};

function createPuzzle(level: Difficulty) {
  const puzzle = puzzles[level];
  return puzzle.split("").map(Number);
}

export default function SudokuPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [initial, setInitial] = useState(() => createPuzzle("easy"));
  const [board, setBoard] = useState(() => createPuzzle("easy"));
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  function restart(level: Difficulty = difficulty) {
    const next = createPuzzle(level);
    setDifficulty(level);
    setInitial(next);
    setBoard(next);
    setSelected(null);
    setMessage("");
  }

  function enterNumber(number: number) {
    if (selected === null || initial[selected] !== 0) return;

    const next = [...board];
    next[selected] = number;
    setBoard(next);
    setMessage("");
  }

  function checkBoard() {
    for (let row = 0; row < 9; row++) {
      const values = board.slice(row * 9, row * 9 + 9);
      if (values.some(value => value === 0) || new Set(values).size !== 9) {
        setMessage("Not quite right. Check your rows.");
        return;
      }
    }

    for (let column = 0; column < 9; column++) {
    const values = board.filter((_, index) => index % 9 === column);
      if (new Set(values).size !== 9) {
        setMessage("Check your columns.");
        return;
      }
    }

    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxColumn = 0; boxColumn < 3; boxColumn++) {
        const values: number[] = [];

        for (let row = 0; row < 3; row++) {
          for (let column = 0; column < 3; column++) {
            values.push(
              board[(boxRow * 3 + row) * 9 + boxColumn * 3 + column]
            );
          }
        }

        if (new Set(values).size !== 9) {
          setMessage("Check each 3 × 3 square.");
          return;
        }
      }
    }

    setMessage("You solved the Sudoku!");
  }

  return (
    <main className="sudoku-page">
      <header className="memory-header">
        <Link href="/" className="back-link">← Keith's Games</Link>
        <span>🔢 Sudoku</span>
      </header>

      <section className="sudoku-content">
        <h1>Sudoku</h1>
        <p>Fill every row, column and square with numbers 1–9.</p>

        <div className="sudoku-controls">
          {(["easy", "medium", "hard"] as Difficulty[]).map(level => (
            <button
              key={level}
              className={difficulty === level ? "active" : ""}
              onClick={() => restart(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
          <button onClick={() => restart()}>New puzzle</button>
        </div>

        <div className="sudoku-layout">
          <div className="sudoku-board">
            {board.map((value, index) => (
              <button
                key={index}
                className={`sudoku-cell ${initial[index] !== 0 ? "fixed" : ""} ${selected === index ? "selected" : ""} ${Math.floor(index / 9) % 3 === 2 ? "box-bottom" : ""} ${index % 9 % 3 === 2 ? "box-right" : ""}`}
                onClick={() => setSelected(index)}
              >
                {value || ""}
              </button>
            ))}
          </div>

          <div className="sudoku-number-pad">
            {Array.from({ length: 9 }, (_, index) => index + 1).map(number => (
              <button key={number} onClick={() => enterNumber(number)}>
                {number}
              </button>
            ))}
            <button onClick={() => enterNumber(0)}>Clear</button>
            <button onClick={checkBoard}>Check answers</button>
          </div>
        </div>

        {message && <p className="sudoku-message">{message}</p>}
      </section>
    </main>
  );
}
