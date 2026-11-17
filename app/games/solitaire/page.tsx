"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Suit = "♥" | "♦" | "♣" | "♠";

type Card = {
  id: number;
  suit: Suit;
  value: number;
  faceUp: boolean;
};

type Selection = {
  column: number;
  index: number;
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

function dealGame() {
  const cards = makeDeck();
  const nextColumns: Card[][] = [];
  let position = 0;

  for (let column = 0; column < 7; column++) {
    const pile = cards.slice(position, position + column + 1);
    position += column + 1;
    pile[pile.length - 1].faceUp = true;
    nextColumns.push(pile);
  }

  return {
    columns: nextColumns,
    stock: cards.slice(position),
    waste: []
  };
}

export default function SolitairePage() {
  const [columns, setColumns] = useState<Card[][]>([]);
  const [stock, setStock] = useState<Card[]>([]);
  const [waste, setWaste] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [moves, setMoves] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const game = dealGame();
    setColumns(game.columns);
    setStock(game.stock);
    setWaste(game.waste);
  }, []);

  function newGame() {
    const game = dealGame();

    setColumns(game.columns);
    setStock(game.stock);
    setWaste(game.waste);
    setSelected(null);
    setMoves(0);
    setMessage("");
  }

  function drawCard() {
    if (stock.length === 0) {
      if (waste.length === 0) return;

      setStock(
        waste
          .slice()
          .reverse()
          .map(card => ({ ...card, faceUp: false }))
      );
      setWaste([]);
    } else {
      const card = stock[stock.length - 1];

      setWaste([...waste, { ...card, faceUp: true }]);
      setStock(stock.slice(0, -1));
    }

    setSelected(null);
    setMoves(value => value + 1);
  }

  function moveColumnToColumn(targetColumn: number) {
    if (!selected) return;

    const moving = columns[selected.column].slice(selected.index);
    const target = columns[targetColumn];
    const movingCard = moving[0];
    const targetCard = target[target.length - 1];

    const valid =
      target.length === 0
        ? movingCard.value === 13
        : targetCard.value === movingCard.value + 1 &&
          isRed(targetCard.suit) !== isRed(movingCard.suit);

    if (!valid) {
      setSelected(null);
      return;
    }

    const next = columns.map(pile => [...pile]);

    next[selected.column] = next[selected.column].slice(
      0,
      selected.index
    );

    next[targetColumn] = [...next[targetColumn], ...moving];

    if (next[selected.column].length > 0) {
      next[selected.column][next[selected.column].length - 1].faceUp = true;
    }

    setColumns(next);
    setSelected(null);
    setMoves(value => value + 1);
    setMessage("");
  }

  function selectCard(column: number, index: number) {
    const card = columns[column][index];

    if (!card.faceUp) return;

    if (selected) {
      if (
        selected.column === column &&
        selected.index === index
      ) {
        setSelected(null);
        return;
      }

      moveColumnToColumn(column);
      return;
    }

    setSelected({ column, index });
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
    setMessage("");
  }

  function handleColumnClick(column: number) {
    if (selected) {
      moveColumnToColumn(column);
      return;
    }

    if (waste.length > 0) {
      moveWasteToColumn(column);
    }
  }

  return (
    <main className="solitaire-page">
      <header className="memory-header">
        <Link href="/" className="back-link">
          ← Keith's Games
        </Link>
        <span>🃏 Solitaire</span>
      </header>

      <section className="solitaire-content">
        <h1>Solitaire</h1>
        <p>
          Build descending piles in alternating colours.
          Put kings in empty columns.
        </p>

        <div className="solitaire-toolbar">
          <span>
            Moves: <strong>{moves}</strong>
          </span>
          <button onClick={newGame}>New game</button>
        </div>

        <div className="solitaire-top">
          <button
            className="solitaire-card stock-card"
            onClick={drawCard}
            aria-label="Draw a card"
          >
            {stock.length > 0 ? "↻" : waste.length > 0 ? "↺" : ""}
          </button>

          <div className="solitaire-card waste-card">
            {waste.length > 0 && (
              <button
                onClick={() => setMessage("Select a column to place this card.")}
              >
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
            <div
              className="solitaire-column"
              key={column}
              onClick={() => handleColumnClick(column)}
            >
              {pile.map((card, index) => (
                <button
                  key={card.id}
                  className={`solitaire-card playing-card ${
                    card.faceUp ? "face-up" : "face-down"
                  } ${
                    isRed(card.suit) ? "red-card" : "black-card"
                  } ${
                    selected?.column === column &&
                    index >= selected.index
                      ? "card-selected"
                      : ""
                  }`}
                  style={{
                    top: `${index * 27}px`,
                    zIndex: index + 1
                  }}
                  onClick={event => {
                    event.stopPropagation();

                    if (card.faceUp) {
                      selectCard(column, index);
                    }
                  }}
                  disabled={!card.faceUp}
                >
                  {card.faceUp
                    ? `${displayValue(card.value)}${card.suit}`
                    : ""}
                </button>
              ))}
            </div>
          ))}
        </div>

        {message && <p className="solitaire-help">{message}</p>}

        <p className="solitaire-help">
          Draw cards from the deck. Select a face-up card,
          then select a valid pile to move it.
        </p>
      </section>
    </main>
  );
}
