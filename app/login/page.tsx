
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        if (username.trim().length < 3) {
          throw new Error("Username must be at least 3 characters.");
        }

        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
              display_name: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Account created. Check your email to confirm your account, then sign in."
          );
          setMode("login");
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 20,
      background: "#090b14",
      color: "#f5f6ff",
      fontFamily: "Inter, Arial, sans-serif",
    },
    card: {
      width: "100%",
      maxWidth: 430,
      padding: 32,
      borderRadius: 22,
      background: "#151827",
      border: "1px solid #292e43",
      boxShadow: "0 20px 70px #0008",
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      padding: "14px 15px",
      borderRadius: 10,
      border: "1px solid #343a50",
      background: "#0e1220",
      color: "white",
      outline: "none",
      fontSize: 15,
      marginTop: 7,
    },
    label: {
      display: "block",
      fontSize: 13,
      fontWeight: 700,
      color: "#c5c9d8",
      marginTop: 17,
    },
    button: {
      width: "100%",
      padding: 15,
      border: 0,
      borderRadius: 11,
      background: "linear-gradient(110deg, #8b5cf6, #5b8cff)",
      color: "white",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      marginTop: 24,
    },
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 27 }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -2 }}>
            Keith&apos;s <span style={{ color: "#a78bfa" }}>Games</span>
          </div>
          <p style={{ color: "#9299b0", fontSize: 14 }}>
            Your games. Your progress. Your account.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 9,
              border: "1px solid #343a50",
              background: mode === "login" ? "#343052" : "#0e1220",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 9,
              border: "1px solid #343a50",
              background: mode === "signup" ? "#343052" : "#0e1220",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Create Account
          </button>
        </div>

        <h1 style={{ fontSize: 23, margin: "0 0 7px" }}>
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p style={{ color: "#9299b0", fontSize: 13, marginTop: 0 }}>
          {mode === "signup"
            ? "Join Keith's Games and save your progress."
            : "Sign in to continue playing."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                minLength={3}
                maxLength={20}
                required
              />
            </>
          )}

          <label style={styles.label}>Email address</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
          />

          {error && (
            <p style={{ color: "#ff7777", fontSize: 13, marginTop: 15 }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{ color: "#65d6a0", fontSize: 13, marginTop: 15 }}>
              {message}
            </p>
          )}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#858ca3", fontSize: 12, marginTop: 22 }}>
          {mode === "signup"
            ? "Already have an account?"
            : "New to Keith's Games?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setMessage("");
            }}
            style={{
              background: "none",
              border: 0,
              color: "#b69aff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
