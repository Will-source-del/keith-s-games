"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  player_id: string;
  username: string;
  email: string;
  coins: number;
};

export default function OwnerPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("Owner coin reward");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function searchPlayers(term: string) {
    const { data, error } = await supabase.rpc(
      "owner_search_players",
      { search_text: term }
    );

    if (error) {
      setError(error.message);
      setPlayers([]);
      return;
    }

    setError("");
    setPlayers((data || []) as Player[]);
  }

  useEffect(() => {
    let active = true;

    async function checkOwner() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const { data: playerData, error: ownerError } =
        await supabase.rpc("owner_search_players", {
          search_text: "",
        });

      if (!active) return;

      if (ownerError) {
        setError(ownerError.message);
        setLoading(false);
        return;
      }

      setPlayers((playerData || []) as Player[]);
      setLoading(false);
    }

    checkOwner();

    return () => {
      active = false;
    };
  }, [router]);

  async function adjustCoins(direction: 1 | -1) {
    if (!selected) return;

    const value = Number(amount);

    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 1000000
    ) {
      setError("Enter a whole number between 1 and 1,000,000.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase.rpc(
      "manage_player_coins",
      {
        target_user: selected.player_id,
        coin_amount: value * direction,
        transaction_reason: reason,
      }
    );

    if (error) {
      setError(error.message);
    } else {
      const updated = {
        ...selected,
        coins: Number(data),
      };

      setSelected(updated);
      setMessage(
        `${value} coins ${
          direction > 0 ? "given to" : "removed from"
        } ${selected.email}.`
      );

      await searchPlayers(search);
    }

    setWorking(false);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        Checking owner access...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <a href="/" style={styles.back}>
          ← Back to games
        </a>

        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>KEITH'S GAMES</div>
            <h1>Owner Panel</h1>
            <p>Manage players and Slingshot Adventures coins.</p>
          </div>
          <div style={styles.ownerBadge}>OWNER</div>
        </header>

        <section style={styles.card}>
          <h2>Find a player</h2>

          <input
            style={styles.input}
            placeholder="Search email or username..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              setSelected(null);
              searchPlayers(value);
            }}
          />

          <div style={styles.playerList}>
            {players.map((player) => (
              <button
                key={player.player_id}
                onClick={() => {
                  setSelected(player);
                  setError("");
                  setMessage("");
                }}
                style={{
                  ...styles.player,
                  borderColor:
                    selected?.player_id === player.player_id
                      ? "#a78bfa"
                      : "#292e43",
                }}
              >
                <span style={styles.playerInfo}>
                  <strong>{player.username}</strong>
                  <small>{player.email}</small>
                </span>

                <strong>🪙 {player.coins}</strong>
              </button>
            ))}

            {players.length === 0 && (
              <p style={styles.muted}>No players found.</p>
            )}
          </div>
        </section>

        {selected && (
          <section style={styles.card}>
            <h2>Manage coins</h2>

            <div style={styles.selected}>
              <div>
                <strong>{selected.username}</strong>
                <p style={styles.email}>{selected.email}</p>
              </div>
              <strong>🪙 {selected.coins}</strong>
            </div>

            <label style={styles.label}>Amount</label>
            <input
              style={styles.input}
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <label style={styles.label}>Reason</label>
            <input
              style={styles.input}
              value={reason}
              maxLength={100}
              onChange={(e) => setReason(e.target.value)}
            />

            <div style={styles.actions}>
              <button
                disabled={working}
                onClick={() => adjustCoins(1)}
                style={styles.give}
              >
                {working ? "Please wait..." : "Give Coins"}
              </button>

              <button
                disabled={working}
                onClick={() => adjustCoins(-1)}
                style={styles.remove}
              >
                {working ? "Please wait..." : "Remove Coins"}
              </button>
            </div>
          </section>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#090b14",
    color: "#f5f6ff",
    padding: 24,
    fontFamily: "Inter, Arial, sans-serif",
  },
  container: {
    maxWidth: 760,
    margin: "25px auto",
  },
  back: {
    color: "#b69aff",
    textDecoration: "none",
    fontWeight: 700,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    margin: "35px 0 25px",
  },
  eyebrow: {
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 2,
  },
  ownerBadge: {
    padding: "9px 14px",
    background: "#3b2d60",
    color: "#d9c5ff",
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 900,
  },
  card: {
    background: "#151827",
    border: "1px solid #292e43",
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 10,
    background: "#0e1220",
    color: "white",
    border: "1px solid #343a50",
    marginTop: 10,
    outline: "none",
  },
  playerList: {
    display: "grid",
    gap: 8,
    marginTop: 15,
  },
  player: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: 14,
    borderRadius: 10,
    background: "#0e1220",
    color: "white",
    border: "1px solid #292e43",
    textAlign: "left",
    cursor: "pointer",
  },
  playerInfo: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  selected: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: 15,
    background: "#25203b",
    borderRadius: 10,
    overflowWrap: "anywhere",
  },
  email: {
    color: "#a5abc0",
    fontSize: 12,
    margin: "5px 0 0",
  },
  label: {
    display: "block",
    marginTop: 17,
    fontSize: 13,
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 20,
  },
  give: {
    flex: 1,
    padding: 14,
    border: 0,
    borderRadius: 10,
    background: "#238c65",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  remove: {
    flex: 1,
    padding: 14,
    border: 0,
    borderRadius: 10,
    background: "#b74755",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  muted: {
    color: "#9299b0",
    fontSize: 13,
  },
  error: {
    color: "#ff7777",
  },
  success: {
    color: "#54d69b",
  },
};
