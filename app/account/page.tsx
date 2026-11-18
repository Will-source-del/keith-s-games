"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Transaction = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      setUser(authData.user);

      const { data: profileData } = await supabase
        .from("player_profiles")
        .select("username, slingshot_coins, created_at")
        .eq("id", authData.user.id)
        .single();

      const { data: transactionData } = await supabase
        .from("coin_transactions")
        .select("id, amount, reason, created_at")
        .eq("player_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(15);

      setProfile(profileData);
      setTransactions(transactionData || []);
      setLoading(false);
    }

    loadAccount();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return <main style={styles.page}>Loading account...</main>;
  }

  if (!user) return null;

  const username =
    profile?.username ||
    user.user_metadata?.username ||
    "Player";

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <a href="/" style={styles.back}>← Back to games</a>

        <header style={styles.header}>
          <div style={styles.avatar}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1>{username}</h1>
            <p>Player account</p>
          </div>
        </header>

        <div style={styles.coinCard}>
          <span style={{ fontSize: 13, color: "#d8c8ff" }}>
            SLINGSHOT ADVENTURES
          </span>
          <div style={styles.coinAmount}>
            🪙 {profile?.slingshot_coins ?? 0}
          </div>
          <p style={{ color: "#e1d7ff", margin: 0 }}>
            Your available coins
          </p>
        </div>

        <section style={styles.section}>
          <h2>Account details</h2>
          <div style={styles.detail}>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div style={styles.detail}>
            <span>Username</span>
            <strong>{username}</strong>
          </div>
          <div style={styles.detail}>
            <span>Player ID</span>
            <strong style={{ overflowWrap: "anywhere" }}>{user.id}</strong>
          </div>
        </section>

        <section style={styles.section}>
          <h2>Coin history</h2>
          {transactions.length === 0 ? (
            <p style={styles.muted}>No coin transactions yet.</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} style={styles.transaction}>
                <div>
                  <strong>{transaction.reason}</strong>
                  <p style={styles.muted}>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </p>
                </div>
                <strong
                  style={{
                    color: transaction.amount >= 0 ? "#54d69b" : "#ff7777",
                  }}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {transaction.amount} coins
                </strong>
              </div>
            ))
          )}
        </section>

        <button onClick={signOut} style={styles.signOut}>
          Sign Out
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#090b14",
    color: "#f5f6ff",
    padding: 24,
    fontFamily: "Inter, Arial, sans-serif",
  },
  container: {
    maxWidth: 650,
    margin: "30px auto",
  },
  back: {
    color: "#b69aff",
    textDecoration: "none",
    fontWeight: 700,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    margin: "35px 0 25px",
  },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 20,
    background: "linear-gradient(135deg, #8b5cf6, #5b8cff)",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 900,
  },
  coinCard: {
    padding: 25,
    borderRadius: 18,
    background: "linear-gradient(120deg, #6540bb, #344d9c)",
    marginBottom: 25,
  },
  coinAmount: {
    fontSize: 38,
    fontWeight: 900,
    margin: "10px 0",
  },
  section: {
    background: "#151827",
    border: "1px solid #292e43",
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
  },
  detail: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: "13px 0",
    borderTop: "1px solid #292e43",
    fontSize: 14,
  },
  transaction: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "13px 0",
    borderTop: "1px solid #292e43",
    fontSize: 13,
  },
  muted: {
    color: "#9299b0",
    fontSize: 12,
    margin: "5px 0 0",
  },
  signOut: {
    width: "100%",
    padding: 15,
    border: 0,
    borderRadius: 10,
    background: "#dc535d",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
};
