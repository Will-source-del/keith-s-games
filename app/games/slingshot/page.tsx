
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Skin = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  colour: string;
};

type SavedData = {
  unlockedLevels?: number;
  completedLevels?: number[];
  unlockedSkins?: string[];
  selectedSkin?: string;
  bestScores?: Record<number, number>;
};

const skins: Skin[] = [
  { id: "classic", name: "Classic", emoji: "🐦", price: 0, colour: "#b87943" },
  { id: "gold", name: "Golden", emoji: "🌟", price: 150, colour: "#f5c542" },
  { id: "ice", name: "Frost", emoji: "❄️", price: 250, colour: "#62c9ed" },
  { id: "fire", name: "Inferno", emoji: "🔥", price: 350, colour: "#ff714d" },
  { id: "neon", name: "Neon", emoji: "💜", price: 500, colour: "#b58aff" },
  { id: "nature", name: "Nature", emoji: "🌿", price: 650, colour: "#63c985" },
];

const levelCount = 10;

export default function SlingshotPage() {
  const gameRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState(1);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(["classic"]);
  const [selectedSkin, setSelectedSkin] = useState("classic");
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [activeLevel, setActiveLevel] = useState(1);
  const [screen, setScreen] = useState<"home" | "levels" | "game" | "shop">("home");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [dragging, setDragging] = useState(false);
  const [projectile, setProjectile] = useState({ x: 150, y: 310 });
  const [launched, setLaunched] = useState(false);
  const [shots, setShots] = useState(0);
  const [score, setScore] = useState(0);
  const [targetHit, setTargetHit] = useState(false);
  const [levelWon, setLevelWon] = useState(false);
  const [reward, setReward] = useState(0);
  const [message, setMessage] = useState("Drag the bird backwards, then release!");

  const currentSkin = skins.find((skin) => skin.id === selectedSkin) ?? skins[0];

  const refreshCoins = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setUserId(null);
      setCoins(0);
      return;
    }

    setUserId(auth.user.id);

    const { data, error } = await supabase
      .from("player_profiles")
      .select("slingshot_coins")
      .eq("id", auth.user.id)
      .single();

    if (error) throw error;

    setCoins(Number(data.slingshot_coins ?? 0));
  }, []);

  const saveProgress = useCallback(async (data: SavedData) => {
    try {
      setSaving(true);
      await saveGame("slingshot", data);
    } catch (error) {
      console.error("Could not save Slingshot progress:", error);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      try {
        await refreshCoins();

        const data = (await loadGameSave("slingshot")) as SavedData | null;

        if (!active) return;

        if (data) {
          setUnlockedLevels(data.unlockedLevels ?? 1);
          setCompletedLevels(data.completedLevels ?? []);
          setUnlockedSkins(data.unlockedSkins ?? ["classic"]);
          setSelectedSkin(data.selectedSkin ?? "classic");
          setBestScores(data.bestScores ?? {});
        }
      } catch (error) {
        console.error("Could not load Slingshot progress:", error);
        setNotice("Could not load your account balance. Please refresh.");
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadProgress();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [refreshCoins]);

  useEffect(() => {
    if (!loaded) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      saveProgress({
        unlockedLevels,
        completedLevels,
        unlockedSkins,
        selectedSkin,
        bestScores,
      });
    }, 700);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    loaded,
    unlockedLevels,
    completedLevels,
    unlockedSkins,
    selectedSkin,
    bestScores,
    saveProgress,
  ]);

  const resetShot = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setProjectile({ x: 150, y: 310 });
    setDragging(false);
    setLaunched(false);
    setTargetHit(false);
  };

  const startLevel = (level: number) => {
    if (level > unlockedLevels || level < 1) return;

    resetShot();
    setActiveLevel(level);
    setShots(0);
    setScore(0);
    setLevelWon(false);
    setReward(0);
    setMessage("Drag the bird backwards, then release!");
    setScreen("game");
  };

  const getPointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = gameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 150, y: 310 };

    return {
      x: ((event.clientX - rect.left) / rect.width) * 800,
      y: ((event.clientY - rect.top) / rect.height) * 450,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (launched || levelWon) return;

    const point = getPointerPosition(event);
    const distance = Math.hypot(
      point.x - projectile.x,
      point.y - projectile.y
    );

    if (distance < 65) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || launched) return;

    const point = getPointerPosition(event);
    const dx = point.x - 150;
    const dy = point.y - 310;
    const distance = Math.hypot(dx, dy);
    const maxDistance = 95;
    const scale = distance > maxDistance ? maxDistance / distance : 1;

    setProjectile({
      x: 150 + dx * scale,
      y: 310 + dy * scale,
    });
  };

  const finishLevel = async (finalScore: number, finalShots: number) => {
    if (levelWon || busy) return;

    setBusy(true);
    setLevelWon(true);
    setShots(finalShots);
    setScore(finalScore);

    try {
      const { data, error } = await supabase.rpc(
        "complete_slingshot_level",
        { target_level: activeLevel }
      );

      if (error) throw error;

      const earned = Number(data ?? 0);

      setReward(earned);

      setCompletedLevels((previous) =>
        previous.includes(activeLevel)
          ? previous
          : [...previous, activeLevel]
      );

      setUnlockedLevels((previous) =>
        Math.max(previous, Math.min(levelCount, activeLevel + 1))
      );

      setBestScores((previous) => ({
        ...previous,
        [activeLevel]: Math.max(previous[activeLevel] ?? 0, finalScore),
      }));

      await refreshCoins();

      setMessage(
        earned > 0
          ? `Level complete! You earned ${earned} coins.`
          : "Level complete! You have already collected this level's reward."
      );
    } catch (error) {
      console.error("Could not complete level:", error);
      setNotice("Your level was completed, but the coin reward could not be saved. Please try again.");
      setReward(0);
    } finally {
      setBusy(false);
    }
  };

  const launch = () => {
    if (!dragging || launched || levelWon) return;

    setDragging(false);
    setLaunched(true);
    setShots((previous) => previous + 1);

    const dx = 150 - projectile.x;
    const dy = 310 - projectile.y;

    let x = projectile.x;
    let y = projectile.y;

    // Lower launch speed for slower, more controllable shots.
    let vx = dx * 0.095;
    let vy = dy * 0.095;

    const targetX = 600 - (activeLevel - 1) * 12;
    const targetY = 315;
    const strength = Math.hypot(dx, dy);
    const nextShots = shots + 1;
    const nextScore = score + 500 + Math.round(strength * 3);

    setMessage("The bird is flying...");

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      x += vx;
      y += vy;
      vy += 0.19;
      vx *= 0.998;

      setProjectile({ x, y });

      const distance = Math.hypot(x - targetX, y - targetY);

      if (distance < 48 && !targetHit) {
        setTargetHit(true);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setMessage("Target hit!");
        void finishLevel(nextScore, nextShots);
        return;
      }

      if (x > 820 || y > 450 || y < -100 || x < -50) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setLaunched(false);
        setProjectile({ x: 150, y: 310 });
        setMessage("Missed! Take your time and try again.");
      }
    }, 24);
  };

  const buySkin = async (skin: Skin) => {
    if (busy) return;

    if (unlockedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      return;
    }

    if (coins < skin.price) {
      setNotice("You do not have enough coins for this skin.");
      return;
    }

    if (!userId) {
      setNotice("Sign in to purchase and save skins.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const { data, error } = await supabase.rpc(
        "spend_slingshot_coins",
        { coin_amount: skin.price }
      );

      if (error) throw error;

      setCoins(Number(data));

      setUnlockedSkins((previous) => [...previous, skin.id]);
      setSelectedSkin(skin.id);
      setNotice(`${skin.name} skin purchased successfully.`);
    } catch (error) {
      console.error("Could not purchase skin:", error);
      setNotice("Purchase failed. Check your coin balance and try again.");
      await refreshCoins();
    } finally {
      setBusy(false);
    }
  };

  const nextLevel = () => {
    if (activeLevel < levelCount) {
      startLevel(activeLevel + 1);
    } else {
      setScreen("levels");
    }
  };

  if (!loaded) {
    return (
      <main className="loading-screen">
        <div className="loading-icon">🐦</div>
        <h1>Slingshot Adventures</h1>
        <p>Loading your game...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: grid;
            place-content: center;
            text-align: center;
            background: #10131c;
            color: white;
            font-family: Arial, sans-serif;
          }
          .loading-icon { font-size: 48px; }
          p { color: #aab2c4; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="game-app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">🎮</span>
          <span>Keith&apos;s Games</span>
        </Link>

        <div className="nav-label">SLINGSHOT ADVENTURES</div>

        <button
          className={`nav-button ${screen === "home" ? "active" : ""}`}
          onClick={() => setScreen("home")}
        >
          <span>⌂</span> Dashboard
        </button>

        <button
          className={`nav-button ${screen === "levels" ? "active" : ""}`}
          onClick={() => setScreen("levels")}
        >
          <span>▦</span> Levels
        </button>

        <button
          className={`nav-button ${screen === "shop" ? "active" : ""}`}
          onClick={() => setScreen("shop")}
        >
          <span>🛍️</span> Coin shop
        </button>

        <div className="sidebar-bottom">
          <div className="player-avatar">K</div>
          <div>
            <strong>Keith</strong>
            <small>{userId ? "Signed in" : "Guest player"}</small>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR ARCADE</div>
            <h1>Slingshot Adventures</h1>
          </div>

          <div className="topbar-right">
            <div className="coin-pill">
              <span>🪙</span>
              <strong>{coins.toLocaleString()}</strong>
              <small>COINS</small>
            </div>
            <div className="save-status">
              {saving ? "Saving..." : "● Saved"}
            </div>
          </div>
        </header>

        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        {screen === "home" && (
          <div className="dashboard">
            <section className="hero">
              <div className="hero-copy">
                <span className="hero-tag">🐦 THE ADVENTURE STARTS HERE</span>
                <h2>Ready, aim, <span>launch!</span></h2>
                <p>Take aim, knock down the targets and earn coins as you progress.</p>
                <button
                  className="primary-button"
                  onClick={() => startLevel(unlockedLevels)}
                >
                  Play level {unlockedLevels} <span>→</span>
                </button>
              </div>
              <div className="hero-art">🎯</div>
            </section>

            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR PROGRESS</span>
                <h2>Adventure overview</h2>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple">🏆</div>
                <div className="stat-number">{completedLevels.length}/{levelCount}</div>
                <div className="stat-label">Levels completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon yellow">🪙</div>
                <div className="stat-number">{coins.toLocaleString()}</div>
                <div className="stat-label">Account coin balance</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">🔓</div>
                <div className="stat-number">{unlockedLevels}/{levelCount}</div>
                <div className="stat-label">Levels unlocked</div>
              </div>
            </div>

            <div className="section-heading">
              <div>
                <span className="eyebrow">KEEP PLAYING</span>
                <h2>Your adventure</h2>
              </div>
              <button className="text-button" onClick={() => setScreen("levels")}>
                All levels →
              </button>
            </div>

            <div className="quick-levels">
              {[1, 2, 3].map((level) => (
                <button
                  className="quick-level"
                  key={level}
                  disabled={level > unlockedLevels}
                  onClick={() => startLevel(level)}
                >
                  <span className="quick-level-icon">
                    {completedLevels.includes(level) ? "🏆" : "🎯"}
                  </span>
                  <span>
                    <strong>Level {level}</strong>
                    <small>
                      {completedLevels.includes(level)
                        ? "Completed"
                        : level > unlockedLevels
                          ? "Locked"
                          : "Ready to play"}
                    </small>
                  </span>
                  <span className="quick-arrow">→</span>
                </button>
              ))}
            </div>

            <section className="shop-promo">
              <div className="promo-icon">🛍️</div>
              <div>
                <h3>Customise your bird</h3>
                <p>Collect coins and unlock new designs in the shop.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setScreen("shop")}
              >
                Visit shop →
              </button>
            </section>
          </div>
        )}

        {screen === "levels" && (
          <section className="page-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR JOURNEY</span>
                <h2>Choose a level</h2>
                <p className="muted">Complete levels to unlock the next challenge.</p>
              </div>
            </div>

            <div className="level-grid">
              {Array.from({ length: levelCount }, (_, index) => {
                const level = index + 1;
                const locked = level > unlockedLevels;
                const completed = completedLevels.includes(level);

                return (
                  <button
                    key={level}
                    className={`level-card ${completed ? "completed" : ""}`}
                    disabled={locked}
                    onClick={() => startLevel(level)}
                  >
                    <span className="level-symbol">
                      {locked ? "🔒" : completed ? "🏆" : "🎯"}
                    </span>
                    <strong>Level {level}</strong>
                    <small>
                      {locked ? "Locked" : completed ? "Completed" : "Available"}
                    </small>
                    {bestScores[level] ? (
                      <span className="level-score">{bestScores[level]} pts</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {screen === "shop" && (
          <section className="page-section">
            <div className="shop-header">
              <div>
                <span className="eyebrow">THE COLLECTION</span>
                <h2>Bird shop</h2>
                <p className="muted">Spend your account coins on new designs.</p>
              </div>
              <div className="shop-balance">🪙 {coins.toLocaleString()} coins</div>
            </div>

            <div className="skin-grid">
              {skins.map((skin) => {
                const owned = unlockedSkins.includes(skin.id);
                const selected = selectedSkin === skin.id;

                return (
                  <div className="skin-card" key={skin.id}>
                    <div
                      className="skin-preview"
                      style={{ background: `${skin.colour}20` }}
                    >
                      <span style={{ color: skin.colour }}>{skin.emoji}</span>
                    </div>
                    <h3>{skin.name}</h3>
                    <p>
                      {skin.id === "classic"
                        ? "The original design"
                        : "A new look for your bird"}
                    </p>
                    <button
                      className={`skin-button ${selected ? "selected" : ""}`}
                      disabled={busy || (!owned && coins < skin.price)}
                      onClick={() => void buySkin(skin)}
                    >
                      {selected
                        ? "✓ Equipped"
                        : owned
                          ? "Equip"
                          : `🪙 ${skin.price}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="shop-note">
              💡 Complete a level for 30 account coins the first time.
            </div>
          </section>
        )}

        {screen === "game" && (
          <section className="play-section">
            <div className="play-header">
              <div>
                <span className="eyebrow">SLINGSHOT CHALLENGE</span>
                <h2>Level {activeLevel}</h2>
              </div>
              <div className="play-stats">
                <span>🎯 {shots} shots</span>
                <span>⭐ {score} points</span>
              </div>
            </div>

            <div className="game-board">
              <svg
                ref={gameRef}
                viewBox="0 0 800 450"
                className="game-svg"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={launch}
                onPointerCancel={launch}
              >
                <defs>
                  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9bd8f8" />
                    <stop offset="100%" stopColor="#e5f6ff" />
                  </linearGradient>
                  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d9a36b" />
                    <stop offset="100%" stopColor="#956039" />
                  </linearGradient>
                </defs>

                <rect width="800" height="450" fill="url(#sky)" />
                <circle cx="680" cy="75" r="36" fill="#ffe49a" />
                <path d="M0 350 Q180 300 350 355 T800 340 V450 H0Z" fill="#a7d58a" />
                <path d="M0 385 Q250 345 500 390 T800 370 V450 H0Z" fill="#75b96c" />

                <g opacity="0.35" fill="#fff">
                  <ellipse cx="160" cy="100" rx="55" ry="17" />
                  <ellipse cx="190" cy="90" rx="32" ry="22" />
                  <ellipse cx="430" cy="145" rx="48" ry="14" />
                  <ellipse cx="455" cy="135" rx="28" ry="20" />
                </g>

                <g>
                  <rect x="570" y="260" width="20" height="140" rx="3" fill="url(#wood)" stroke="#704629" strokeWidth="2" />
                  <rect x="680" y="260" width="20" height="140" rx="3" fill="url(#wood)" stroke="#704629" strokeWidth="2" />
                  <rect x="560" y="245" width="150" height="18" rx="4" fill="url(#wood)" stroke="#704629" strokeWidth="2" />
                  <rect x="590" y="205" width="20" height="40" rx="3" fill="#b6dff0" stroke="#6d9eaf" strokeWidth="2" />
                  <rect x="650" y="205" width="20" height="40" rx="3" fill="#b6dff0" stroke="#6d9eaf" strokeWidth="2" />
                  <rect x="580" y="190" width="100" height="15" rx="4" fill="url(#wood)" stroke="#704629" strokeWidth="2" />
                  <rect x="615" y="150" width="25" height="40" rx="3" fill="url(#wood)" stroke="#704629" strokeWidth="2" />
                </g>

                <g opacity={targetHit ? 0.2 : 1}>
                  <ellipse cx={600 - (activeLevel - 1) * 12} cy="315" rx="25" ry="22" fill="#65bb4c" stroke="#3d8536" strokeWidth="3" />
                  <ellipse cx={590 - (activeLevel - 1) * 12} cy="307" rx="5" ry="7" fill="white" />
                  <ellipse cx={610 - (activeLevel - 1) * 12} cy="307" rx="5" ry="7" fill="white" />
                  <circle cx={591 - (activeLevel - 1) * 12} cy="308" r="2.5" fill="#222" />
                  <circle cx={611 - (activeLevel - 1) * 12} cy="308" r="2.5" fill="#222" />
                  <path d={`M${590 - (activeLevel - 1) * 12} 323 Q${600 - (activeLevel - 1) * 12} 331 ${610 - (activeLevel - 1) * 12} 323`} fill="none" stroke="#315d2b" strokeWidth="2" />
                </g>

                <path
                  d="M125 390 L145 310 L170 390"
                  fill="none"
                  stroke="#80502f"
                  strokeWidth="16"
                  strokeLinecap="round"
                />

                {dragging && (
                  <line
                    x1="145"
                    y1="310"
                    x2={projectile.x}
                    y2={projectile.y}
                    stroke="#75502e"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}

                <path
                  d={`M125 390 Q135 350 ${projectile.x} ${projectile.y}`}
                  fill="none"
                  stroke={currentSkin.colour}
                  strokeWidth="7"
                  strokeLinecap="round"
                />

                <circle
                  cx={projectile.x}
                  cy={projectile.y}
                  r="21"
                  fill={currentSkin.colour}
                  stroke="#fff"
                  strokeWidth="3"
                />
                <text
                  x={projectile.x}
                  y={projectile.y + 8}
                  textAnchor="middle"
                  fontSize="24"
                >
                  🐦
                </text>

                {dragging && (
                  <line
                    x1={projectile.x}
                    y1={projectile.y}
                    x2={projectile.x + (150 - projectile.x) * 2}
                    y2={projectile.y + (310 - projectile.y) * 2}
                    stroke="#334155"
                    strokeDasharray="7 7"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                )}
              </svg>

              <div className="game-message">{message}</div>
            </div>

            <div className="game-controls">
              <button className="secondary-button" onClick={resetShot}>
                ↻ Reset shot
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  resetShot();
                  setScreen("levels");
                }}
              >
                Exit level
              </button>
              <div className="game-tip">Drag the bird back and release to launch.</div>
            </div>

            {levelWon && (
              <div className="win-panel">
                <div className="win-emoji">🏆</div>
                <h2>Level completed!</h2>
                <p>You scored {score.toLocaleString()} points.</p>
                <div className="win-reward">
                  🪙 +{reward} coins
                </div>
                <div className="win-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setScreen("levels")}
                  >
                    Levels
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={nextLevel}
                  >
                    {busy
                      ? "Saving..."
                      : activeLevel === levelCount
                        ? "Finish"
                        : "Next level →"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="footer">
          <span>Keith&apos;s Games</span>
          <span>Slingshot Adventures</span>
        </footer>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <style jsx>{`
        .game-app {
          min-height: 100vh;
          display: flex;
          background: #10131c;
          color: #f4f5fa;
          font-family: Arial, Helvetica, sans-serif;
        }
        button { font: inherit; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .42; }
        .sidebar {
          width: 245px;
          flex-shrink: 0;
          min-height: 100vh;
          background: #171b27;
          border-right: 1px solid #292f40;
          padding: 26px 18px;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: white;
          font-size: 17px;
          font-weight: 800;
          text-decoration: none;
          margin: 0 5px 55px;
        }
        .brand-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #7457df;
          font-size: 20px;
        }
        .nav-label, .eyebrow {
          color: #858da4;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .nav-label { margin: 0 9px 13px; }
        .nav-button {
          display: flex;
          align-items: center;
          gap: 13px;
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 13px 12px;
          margin-bottom: 5px;
          color: #aeb5c7;
          background: transparent;
          text-align: left;
          font-size: 13px;
        }
        .nav-button span { width: 20px; font-size: 18px; text-align: center; }
        .nav-button.active, .nav-button:hover {
          color: white;
          background: #29263e;
        }
        .nav-button.active { box-shadow: inset 3px 0 #9b80ff; }
        .sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #303547;
          padding: 20px 5px 0;
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .player-avatar {
          width: 37px;
          height: 37px;
          border-radius: 50%;
          background: #4c9b83;
          display: grid;
          place-items: center;
          font-weight: 800;
        }
        .sidebar-bottom strong, .sidebar-bottom small { display: block; }
        .sidebar-bottom strong { font-size: 13px; }
        .sidebar-bottom small { color: #929aaf; margin-top: 4px; }
        .main-content { flex: 1; min-width: 0; padding: 28px 38px 20px; }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }
        h1, h2, h3, p { margin-top: 0; }
        .topbar h1 { font-size: 23px; margin: 7px 0 0; letter-spacing: -.6px; }
        .topbar-right { display: flex; align-items: center; gap: 15px; }
        .coin-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #55472b;
          background: #292418;
          padding: 10px 14px;
          border-radius: 12px;
          color: #f6cf68;
        }
        .coin-pill strong { font-size: 15px; }
        .coin-pill small { font-size: 9px; letter-spacing: 1px; color: #c5a95e; }
        .save-status { font-size: 11px; color: #76c89c; }
        .hero {
          min-height: 225px;
          padding: 33px 38px;
          border-radius: 19px;
          background: linear-gradient(110deg, #382c68, #59418b 58%, #8a5d9d);
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
        }
        .hero-copy { max-width: 520px; position: relative; z-index: 1; }
        .hero-tag { color: #d5c9ff; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; }
        .hero h2 { font-size: clamp(27px, 4vw, 39px); margin: 14px 0 9px; letter-spacing: -1.3px; }
        .hero h2 span { color: #f7d579; }
        .hero p { color: #ded7f2; font-size: 13px; line-height: 1.6; margin-bottom: 20px; }
        .hero-art { font-size: 112px; margin-right: 45px; filter: drop-shadow(0 12px 12px #241a4540); }
        .primary-button, .secondary-button {
          border: 0;
          border-radius: 9px;
          padding: 12px 17px;
          font-size: 12px;
          font-weight: 800;
          transition: transform .15s, filter .15s;
        }
        .primary-button:hover, .secondary-button:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .primary-button { background: #f1cc70; color: #292013; }
        .primary-button span { margin-left: 10px; }
        .secondary-button { background: #303749; color: #f2f3f8; }
        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 31px 0 17px;
        }
        .section-heading h2, .shop-header h2, .play-header h2 {
          font-size: 20px;
          margin: 6px 0 0;
          letter-spacing: -.5px;
        }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .stat-card {
          background: #191e2b;
          border: 1px solid #2b3142;
          border-radius: 13px;
          padding: 17px;
        }
        .stat-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          margin-bottom: 14px;
        }
        .stat-icon.purple { background: #352c54; }
        .stat-icon.yellow { background: #40371e; }
        .stat-icon.green { background: #203d34; }
        .stat-number { font-size: 25px; font-weight: 800; }
        .stat-label { color: #929bb0; font-size: 11px; margin-top: 5px; }
        .text-button { background: none; border: 0; color: #b7a5ff; font-size: 12px; font-weight: 700; }
        .quick-levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }
        .quick-level {
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          background: #191e2b;
          border: 1px solid #2b3142;
          border-radius: 12px;
          color: white;
          padding: 14px;
        }
        .quick-level-icon { font-size: 23px; }
        .quick-level strong, .quick-level small { display: block; }
        .quick-level strong { font-size: 12px; }
        .quick-level small { color: #929bb0; font-size: 10px; margin-top: 5px; }
        .quick-arrow { margin-left: auto; color: #a99aff; }
        .shop-promo {
          margin-top: 22px;
          padding: 17px 19px;
          display: flex;
          align-items: center;
          gap: 15px;
          background: #1d2230;
          border: 1px solid #34384d;
          border-radius: 13px;
        }
        .promo-icon { font-size: 28px; }
        .shop-promo h3 { font-size: 13px; margin-bottom: 5px; }
        .shop-promo p { color: #9da5b7; font-size: 11px; margin: 0; }
        .shop-promo .secondary-button { margin-left: auto; white-space: nowrap; }
        .page-section { max-width: 1100px; }
        .muted { color: #969fb3; font-size: 12px; margin: 8px 0 0; }
        .level-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 13px; }
        .level-card {
          min-height: 140px;
          border: 1px solid #303649;
          border-radius: 13px;
          background: #1a1f2d;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .level-card.completed { border-color: #658e78; background: #1d302c; }
        .level-symbol { font-size: 27px; }
        .level-card strong { font-size: 13px; }
        .level-card small, .level-score { color: #9ba5b8; font-size: 10px; }
        .shop-header, .play-header { display: flex; justify-content: space-between; align-items: center; gap: 15px; }
        .shop-balance {
          color: #f3cf73;
          background: #292418;
          border: 1px solid #57492b;
          border-radius: 10px;
          padding: 12px 15px;
          font-size: 12px;
          font-weight: 800;
        }
        .skin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 25px; }
        .skin-card {
          background: #1a1f2d;
          border: 1px solid #303649;
          border-radius: 14px;
          padding: 15px;
          text-align: center;
        }
        .skin-preview {
          height: 115px;
          border-radius: 10px;
          display: grid;
          place-items: center;
        }
        .skin-preview span { font-size: 52px; }
        .skin-card h3 { font-size: 14px; margin: 14px 0 6px; }
        .skin-card p { font-size: 10px; color: #929bb0; min-height: 24px; }
        .skin-button {
          width: 100%;
          border: 0;
          border-radius: 8px;
          padding: 10px;
          background: #7457df;
          color: white;
          font-weight: 800;
          font-size: 11px;
        }
        .skin-button.selected { background: #244c3d; color: #9ee0bb; }
        .skin-button:disabled { background: #303749; color: #929bb0; }
        .shop-note {
          margin-top: 18px;
          padding: 14px;
          border-radius: 10px;
          background: #26283a;
          color: #c4c7d6;
          font-size: 11px;
        }
        .play-section { max-width: 1000px; }
        .play-stats { display: flex; gap: 10px; }
        .play-stats span { padding: 10px 13px; background: #202638; border-radius: 9px; color: #d5d9e5; font-size: 11px; }
        .game-board {
          margin-top: 20px;
          overflow: hidden;
          border: 1px solid #3b4356;
          border-radius: 15px;
          background: #b8e6f9;
          position: relative;
        }
        .game-svg { display: block; width: 100%; touch-action: none; cursor: crosshair; }
        .game-message {
          background: #171c2be8;
          color: white;
          padding: 11px;
          text-align: center;
          font-size: 12px;
        }
        .game-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .game-tip { margin-left: auto; color: #9ba5b8; font-size: 11px; }
        .win-panel {
          margin-top: 20px;
          padding: 25px;
          border: 1px solid #557d68;
          border-radius: 14px;
          background: #1d302c;
          text-align: center;
        }
        .win-emoji { font-size: 42px; }
        .win-panel h2 { margin: 10px 0; }
        .win-panel p { color: #b8c9bf; font-size: 13px; }
        .win-reward { color: #f3cf73; font-weight: 800; margin: 15px; }
        .win-actions { display: flex; justify-content: center; gap: 10px; }
        .footer {
          display: flex;
          justify-content: space-between;
          color: #687187;
          font-size: 10px;
          margin-top: 45px;
          padding-top: 17px;
          border-top: 1px solid #292f40;
        }
        .notice {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #302b42;
          border: 1px solid #55477b;
          color: #e3dafa;
          border-radius: 10px;
          padding: 12px 15px;
          margin-bottom: 18px;
          font-size: 12px;
        }
        .notice button {
          border: 0;
          color: white;
          background: transparent;
          font-size: 20px;
        }
        @media (max-width: 850px) {
          .sidebar { width: 190px; padding: 20px 12px; }
          .main-content { padding: 22px 20px; }
          .level-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 620px) {
          .game-app { display: block; }
          .sidebar {
            position: static;
            width: 100%;
            height: auto;
            min-height: 0;
            padding: 12px;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            overflow-x: auto;
          }
          .brand { margin: 0 10px 0 0; white-space: nowrap; }
          .nav-label, .sidebar-bottom { display: none; }
          .nav-button { width: auto; white-space: nowrap; padding: 10px; }
          .main-content { padding: 18px 13px; }
          .topbar { align-items: flex-start; flex-direction: column; }
          .hero { padding: 24px; }
          .hero-art { font-size: 65px; margin: 0; }
          .stats-grid, .quick-levels { grid-template-columns: 1fr; }
          .skin-grid { grid-template-columns: repeat(2, 1fr); }
          .level-grid { grid-template-columns: repeat(2, 1fr); }
          .shop-header, .play-header { align-items: flex-start; flex-direction: column; }
          .game-tip { width: 100%; margin-left: 0; }
        }
      `}</style>
    </main>
  );
}
