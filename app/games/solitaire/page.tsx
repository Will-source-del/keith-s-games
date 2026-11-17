"use client";

import { useState } from "react";
import Link from "next/link";

type Suit = "♥" | "♦" | "♣" | "♠";

type Card = {
  id: number;
  suit: Suit;
  value: number;
  faceUp: boolean;
};

const suits: Suit[] = ["♥", "♦", "♣", "♠"];

function makeDeck(): Card[] {
  return suits
    .flatMap(suit =>
      Array.from({ length: 13 }, (_, index) => ({
        id: suits.indexOf(suit) * 13 + index,
        suit,
        value: index + 1,
        faceUp: false
      }))
    )
    .sort(() => Math.random() - 0.5);
}

function displayValue(value: number) {
  if (value === 1) return "A";
  if (value === 11) return "J";
  if (value === 12) return "Q";
  if (value === 13) return "K";
  return String(value);
}

function isRed(suit: Suit) {
  return suit === "♥" || suit === "♦";
}

export default function SolitairePage() {
  const [deck, setDeck] = useState<Card[]>(() => makeDeck());
  const [stock, setStock] = useState<Card[]>([]);
  const [waste, setWaste] = useState<Card[]>([]);
  const [columns, setColumns] = useState<Card[][]>([]);
  const [selected, setSelected] = useState<{ column: number; index: number } | null>(null);
  const [moves, setMoves] = useState(0);
  const [message, setMessage] = useState("");

  function newGame() {
    const cards = makeDeck();
    const nextColumns: Card[][] = [];
    let position = 0;

    for (let column = 0; column < 7; column++) {
      const pile = cards.slice(position, position + column + 1);
      position += column + 1;
      pile[pile.length - 1].faceUp = true;
      nextColumns.push(pile);
    }

    setColumns(nextColumns);
    setStock(cards.slice(position));
    setWaste([]);
    setSelected(null);
    setMoves(0);
    setMessage("");
  }

  function drawCard() {
    if (stock.length === 0) {
      if (waste.length === 0) return;
      setStock(waste.slice().reverse().map(card => ({ ...card, faceUp: false })));
      setWaste([]);
    } else {
      const card = stock[stock.length - 1];
      setWaste([...waste, { ...card, faceUp: true }]);
      setStock(stock.slice(0, -1));
    }
    setSelected(null);
    setMoves(value => value + 1);
  }

  function selectColumn(column: number, index: number) {
    const card = columns[column][index];

    if (selected) {
      const moving = columns[selected.column].slice(selected.index);
      const target = columns[column];
      const top = target[target.length - 1];

      const valid =
        target.length === 0
          ? moving[0].value === 13
          : top.value === moving[0].value + 1 &&
            isRed(top.suit) !== isRed(moving[0].suit);

      if (valid) {
        const next = columns.map(pile => [...pile]);
        next[selected.column] = next[selected.column].slice(0, selected.index);
        next[column] = [...next[column], ...moving];

        if (next[selected.column].length > 0) {
          next[selected.column][next[selected.column].length - 1].faceUp = true;
        }

        setColumns(next);
        setMoves(value => value + 1);
        setSelected(null);
        checkWin(next);
        return;
      }
    }

    if (card.faceUp) {
      setSelected({ column, index });
    }
  }

  function moveWasteToColumn(column: number) {
    if (waste.length === 0) return;

    const card = waste[waste.length - 1];
    const target = columns[column];
    const top = target[target.length - 1];

    const valid =
      target.length === 0
        ? card.value === 13
        : top.value === card.value + 1 &&
          isRed(top.suit) !== isRed(card.suit);

    if (!valid) return;

    const next = columns.map(pile => [...pile]);
    next[column].push(card);

    setColumns(next);
    setWaste(waste.slice(0, -1));
    setMoves(value => value + 1);
    checkWin(next);
  }

  function checkWin(next: Card[][]) {
    if (next.every(pile => pile.length === 0)) return;

    // A simple win check is handled by the foundation feature in a later step.
  }

  return (
    <main className="solitaire-page">
      <header className="memory-header">
        <Link href="/" className="back-link">← Keith's Games</Link>
        <span>🃏 Solitaire</span>
      </header>

      <section className="solitaire-content">
        <h1>Solitaire</h1>
        <p>Build descending piles in alternating colours. Put kings in empty columns.</p>

        <div className="solitaire-toolbar">
          <span>Moves: <strong>{moves}</strong></span>
          <button onClick={newGame}>New game</button>
        </div>

        <div className="solitaire-top">
          <button className="solitaire-card stock-card" onClick={drawCard}>
            {stock.length ? "↻" : "↺"}
          </button>

          <div className="solitaire-card waste-card">
            {waste.length > 0 && (
              <button onClick={() => {
                const next = [...columns];
                const card = waste[waste.length - 1];
                const pile = next.findIndex(column => column.length === 0 && card.value === 13);
                if (pile !== -1) moveWasteToColumn(pile);
              }}>
                {displayValue(waste[waste.length - 1].value)}
                {waste[waste.length - 1].suit}
              </button>
            )}
          </div>

          <div className="solitaire-foundations">
            {suits.map(suit => (
              <div className="solitaire-card foundation" key={suit}>
                {suit}
              </div>
            ))}
          </div>
        </div>

        <div className="solitaire-columns">
          {columns.map((pile, column) => (
            <div className="solitaire-column" key={column}>
              {pile.map((card, index) => (
                <button
                  key={card.id}
                  className={`solitaire-card playing-card ${card.faceUp ? "face-up" : "face-down"} ${isRed(card.suit) ? "red-card" : "black-card"} ${selected?.column === column && selected.index === index ? "card-selected" : ""}`}
                  style={{ top: `${index * 27}px`, zIndex: index + 1 }}
                  onClick={() => {
                    if (selected) selectColumn(column, index);
                    else selectColumn(column, index);
                    if (waste.length && index === pile.length - 1) {
                      moveWasteToColumn(column);
                    }
                  }}
                >
                  {card.faceUp ? `${displayValue(card.value)}${card.suit}` : ""}
                </button>
              ))}
            </div>
          ))}
        </div>

        <p className="solitaire-help">
          Draw cards from the deck. Select a face-up card and then a valid pile to move it.
        </p>
      </section>
    </main>
  );
}
