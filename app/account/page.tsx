
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);
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
    return (
      <main style={styles.page}>
        <p>Loading account...</p>
      </main>
    );
  }

  if (!user) return null;

  const username =
    user.user_metadata?.username ||
    user.user_metadata?.display_name ||
    "Player";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <a href="/" style={styles.back}>← Back to games</a>

        <div style={styles.avatar}>
          {username.charAt(0).toUpperCase()}
        </div>

        <h1 style={styles.heading}>{username}</h1>
        <p style={styles.muted}>Keith's Games account</p>

        <div style={styles.detail}>
          <span>Email address</span>
          <strong>{user.email}</strong>
        </div>

        <div style={styles.detail}>
          <span>Username</span>
          <strong>{username}</strong>
        </div>

        <div style={styles.detail}>
          <span>Account ID</span>
          <strong style={{ overflowWrap: "anywhere" }}>{user.id}</strong>
        </div>

        <button onClick={signOut} style={styles.button}>
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
    display: "grid",
    placeItems: "center",
    padding: 20,
    fontFamily: "Inter, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    boxSizing: "border-box",
    background: "#151827",
    border: "1px solid #292e43",
    borderRadius: 20,
    padding: 30,
  },
  back: {
    color: "#b69aff",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    background: "linear-gradient(135deg, #8b5cf6, #5b8cff)",
    display: "grid",
    placeItems: "center",
    fontSize: 34,
    fontWeight: 900,
    margin: "30px auto 15px",
  },
  heading: {
    textAlign: "center",
    fontSize: 27,
    margin: 0,
  },
  muted: {
    color: "#9299b0",
    textAlign: "center",
    marginBottom: 28,
  },
  detail: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: "15px 0",
    borderTop: "1px solid #292e43",
    fontSize: 14,
  },
  button: {
    width: "100%",
    padding: 14,
    marginTop: 25,
    border: 0,
    borderRadius: 10,
    background: "#dc535d",
    color: "white",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
};
