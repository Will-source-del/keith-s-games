"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPlayer } from "@/lib/player";
import { supabase } from "@/lib/supabase";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Skin = {
  id: string;
  name: string;
  emoji: string;
  stars: number;
  colour: string;
};

type Power = "boost" | "double" | "magnet";

type Leader = {
  user_id: string;
  player_name: string;
  total_score: number;
  levels_completed: number;
};

const skins: Skin[] = [
  { id: "classic", name: "Classic", emoji: "🪵", stars: 0, colour: "#b87943" },
  { id: "gold", name: "Golden", emoji: "🌟", stars: 5, colour: "#f5c542" },
  { id: "ice", name: "Frost", emoji: "❄️", stars: 10, colour: "#62c9ed" },
  { id: "fire", name: "Inferno", emoji: "🔥", stars: 15, colour: "#ff714d" },
  { id: "neon", name: "Neon", emoji: "💜", stars: 25, colour: "#b58aff" },
  { id: "nature", name: "Nature", emoji: "🌿", stars: 35, colour: "#63c985" },
];

const powerInfo: Record<Power, { name: string; emoji: string; price: number; description: string }> = {
  boost: { name: "Super launch", emoji: "🚀", price: 60, description: "Launch with extra power." },
  double: { name: "Double points", emoji: "✨", price: 80, description: "Double your next level score." },
  magnet: { name: "Target magnet", emoji: "🧲", price: 70, description: "Makes the target easier to hit." },
};

const levelCount = 10;
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function SlingshotPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [screen, setScreen] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [coins, setCoins] = useState(0);
  const [stars, setStars] = useState(0);
  const [unlockedLevels, setUnlockedLevels] = useState(1);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(["classic"]);
  const [selectedSkin, setSelectedSkin] = useState("classic");
  const [powerups, setPowerups] = useState<Record<Power, number>>({
    boost: 0,
    double: 0,
    magnet: 0,
  });

  const [dailyRewardDate, setDailyRewardDate] = useState("");
  const [dailyChallengeDate, setDailyChallengeDate] = useState("");
  const [leaderRewardDate, setLeaderRewardDate] = useState("");
  const [dailyStreak, setDailyStreak] = useState(0);
  const [lastRewardDate, setLastRewardDate] = useState("");

  const [playerName, setPlayerName] = useState("Player");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [myUserId, setMyUserId] = useState("");

  const [activeLevel, setActiveLevel] = useState(1);
  const [dailyMode, setDailyMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [projectile, setProjectile] = useState({ x: 150, y: 310 });
  const [launched, setLaunched] = useState(false);
  const [shots, setShots] = useState(0);
  const [score, setScore] = useState(0);
  const [levelWon, setLevelWon] = useState(false);
  const [reward, setReward] = useState(0);
  const [message, setMessage] = useState("Drag the bird backwards, then release!");
  const [activePower, setActivePower] = useState<Power | null>(null);

  const currentSkin = skins.find((skin) => skin.id === selectedSkin) ?? skins[0];
  const today = todayKey();

  const persist = useCallback(async (extra?: Record<string, unknown>) => {
    try {
      setSaving(true);
      await saveGame("slingshot", {
        coins,
        stars,
        unlockedLevels,
        completedLevels,
        bestScores,
        unlockedSkins,
        selectedSkin,
        powerups,
        dailyRewardDate,
        dailyChallengeDate,
        leaderRewardDate,
        dailyStreak,
        lastRewardDate,
        playerName,
        ...extra,
      });
    } catch (error) {
      console.error("Could not save Slingshot progress:", error);
    } finally {
      setSaving(false);
    }
  }, [
    coins, stars, unlockedLevels, completedLevels, bestScores,
    unlockedSkins, selectedSkin, powerups, dailyRewardDate,
    dailyChallengeDate, leaderRewardDate, dailyStreak,
    lastRewardDate, playerName,
  ]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await loadGameSave("slingshot");
        if (!active) return;

        setCoins(Number(data.coins) || 0);
        setStars(Number(data.stars) || 0);
        setUnlockedLevels(Number(data.unlockedLevels) || 1);
        setCompletedLevels(Array.isArray(data.completedLevels) ? data.completedLevels : []);
        setBestScores(data.bestScores || {});
        setUnlockedSkins(Array.isArray(data.unlockedSkins) ? data.unlockedSkins : ["classic"]);
        setSelectedSkin(data.selectedSkin || "classic");
        setPowerups(data.powerups || { boost: 0, double: 0, magnet: 0 });
        setDailyRewardDate(String(data.dailyRewardDate || ""));
        setDailyChallengeDate(String(data.dailyChallengeDate || ""));
        setLeaderRewardDate(String(data.leaderRewardDate || ""));
        setDailyStreak(Number(data.dailyStreak) || 0);
        setLastRewardDate(String(data.lastRewardDate || ""));
        setPlayerName(String(data.playerName || "Player"));
      } catch (error) {
        console.error("Could not load Slingshot progress:", error);
      } finally {
        if (active) setLoaded(true);
      }
    }

    load();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => persist(), 500);
    return () => window.clearTimeout(timer);
  }, [
    loaded, coins, stars, unlockedLevels, completedLevels, bestScores,
    unlockedSkins, selectedSkin, powerups, dailyRewardDate,
    dailyChallengeDate, leaderRewardDate, dailyStreak,
    lastRewardDate, playerName, persist,
  ]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("slingshot_leaderboard")
        .select("user_id, player_name, total_score, levels_completed")
        .order("total_score", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeaders((data || []) as Leader[]);
    } catch (error) {
      console.error("Could not load leaderboard:", error);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    async function identifyPlayer() {
      try {
        const player = await getPlayer();
        setMyUserId(player.id);
      } catch (error) {
        console.error("Could not identify player:", error);
      }
    }

    identifyPlayer();
    loadLeaderboard();
  }, [loaded, loadLeaderboard]);

  const updateLeaderboard = async (newScore: number, newLevels: number) => {
    try {
      const player = await getPlayer();
      setMyUserId(player.id);

      const { data: existing } = await supabase
        .from("slingshot_leaderboard")
        .select("total_score, levels_completed")
        .eq("user_id", player.id)
        .maybeSingle();

      const totalScore = Math.max(Number(existing?.total_score) || 0, newScore);
      const levelsCompleted = Math.max(Number(existing?.levels_completed) || 0, newLevels);

      const { error } = await supabase
        .from("slingshot_leaderboard")
        .upsert({
          user_id: player.id,
          player_name: playerName.trim().slice(0, 18) || "Player",
          total_score: totalScore,
          levels_completed: levelsCompleted,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      await loadLeaderboard();
    } catch (error) {
      console.error("Could not update leaderboard:", error);
      setMessage("Score saved locally. Leaderboard update failed.");
    }
  };

  const resetShot = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProjectile({ x: 150, y: 310 });
    setDragging(false);
    setLaunched(false);
  };

  const startLevel = (level: number, daily = false) => {
    if (!daily && level > unlockedLevels) return;
    setActiveLevel(level);
    setDailyMode(daily);
    setShots(0);
    setScore(0);
    setLevelWon(false);
    setReward(0);
    setActivePower(null);
    setMessage("Drag the bird backwards, then release!");
    resetShot();
    setScreen("game");
  };

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 150, y: 310 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 800,
      y: ((event.clientY - rect.top) / rect.height) * 450,
    };
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (launched || levelWon) return;
    const point = pointerPosition(event);
    if (Math.hypot(point.x - projectile.x, point.y - projectile.y) < 65) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const point = pointerPosition(event);
    const dx = point.x - 150;
    const dy = point.y - 310;
    const distance = Math.hypot(dx, dy);
    const scale = distance > 95 ? 95 / distance : 1;
    setProjectile({ x: 150 + dx * scale, y: 310 + dy * scale });
  };

  const finishLevel = async (finalScore: number, finalShots: number) => {
    if (levelWon) return;

    setLevelWon(true);
    const firstCompletion = !completedLevels.includes(activeLevel);
    const baseCoins = firstCompletion ? 30 : 0;
    const scoreBonus = finalScore >= 1500 ? 30 : finalScore >= 800 ? 20 : 10;
    const dailyBonus = dailyMode && dailyChallengeDate !== today ? 100 : 0;
    const earned = baseCoins + scoreBonus + dailyBonus;

    setReward(earned);
    setCoins((value) => value + earned);
    setCompletedLevels((value) => value.includes(activeLevel) ? value : [...value, activeLevel]);
    setUnlockedLevels((value) => Math.max(value, Math.min(levelCount, activeLevel + 1)));
    setBestScores((value) => ({
      ...value,
      [activeLevel]: Math.max(value[activeLevel] || 0, finalScore),
    }));

    if (dailyMode && dailyChallengeDate !== today) {
      setDailyChallengeDate(today);
      setStars((value) => value + 2);
    }

    const nextCompleted = completedLevels.includes(activeLevel)
      ? completedLevels.length
      : completedLevels.length + 1;

    setMessage(`Level complete! You earned ${earned} coins.`);
    setShots(finalShots);
    setScore(finalScore);

    await updateLeaderboard(finalScore, nextCompleted);
  };

  const launch = () => {
    if (!dragging || launched || levelWon) return;

    setDragging(false);
    setLaunched(true);
    const finalShots = shots + 1;
    setShots(finalShots);

    const dx = 150 - projectile.x;
    const dy = 310 - projectile.y;
    let x = projectile.x;
    let y = projectile.y;
    let vx = dx * (activePower === "boost" ? 0.25 : 0.17);
    let vy = dy * (activePower === "boost" ? 0.25 : 0.17);

    const targetX = 600 - (activeLevel - 1) * 12;
    const targetY = 270;
    const strength = Math.hypot(dx, dy);
    const hitRadius = activePower === "magnet" ? 68 : 43;

    if (activePower) {
      setPowerups((value) => ({ ...value, [activePower]: Math.max(0, value[activePower] - 1) }));
    }

    const doublePoints = activePower === "double";
    setActivePower(null);
    setMessage("Nice shot!");

    timerRef.current = setInterval(() => {
      x += vx;
      y += vy;
      vy += 0.38;
      vx *= 0.995;
      setProjectile({ x, y });

      if (Math.hypot(x - targetX, y - targetY) < hitRadius) {
        if (timerRef.current) clearInterval(timerRef.current);
        const points = Math.round((500 + strength * 3) * (doublePoints ? 2 : 1));
        const finalScore = score + points;
        setScore(finalScore);
        setMessage("Target hit!");
        window.setTimeout(() => finishLevel(finalScore, finalShots), 250);
        return;
      }

      if (x > 820 || y > 450 || y < -100 || x < -50) {
        if (timerRef.current) clearInterval(timerRef.current);
        setLaunched(false);
        setProjectile({ x: 150, y: 310 });
        setMessage("Missed! Try another shot.");
      }
    }, 16);
  };

  const buyPower = (power: Power) => {
    const item = powerInfo[power];
    if (coins < item.price) return;
    setCoins((value) => value - item.price);
    setPowerups((value) => ({ ...value, [power]: value[power] + 1 }));
  };

  const buySkin = (skin: Skin) => {
    if (unlockedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      return;
    }
    if (stars < skin.stars) return;
    setStars((value) => value - skin.stars);
    setUnlockedSkins((value) => [...value, skin.id]);
    setSelectedSkin(skin.id);
  };

  const claimDailyReward = () => {
    if (dailyRewardDate === today) return;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const streak = lastRewardDate === yesterdayKey ? dailyStreak + 1 : 1;
    const coinReward = Math.min(50 + (streak - 1) * 10, 120);
    const starReward = streak % 7 === 0 ? 3 : 1;

    setCoins((value) => value + coinReward);
    setStars((value) => value + starReward);
    setDailyRewardDate(today);
    setDailyStreak(streak);
    setLastRewardDate(today);
  };

  const claimLeaderboardReward = () => {
    if (leaderRewardDate === today || !myUserId) return;

    const position = leaders.findIndex((entry) => entry.user_id === myUserId) + 1;
    if (position === 0) {
      setMessage("Play a level first to appear on the leaderboard.");
      return;
    }

    const prize = position === 1 ? 250 : position <= 3 ? 150 : position <= 10 ? 75 : 25;
    setCoins((value) => value + prize);
    setLeaderRewardDate(today);
    setMessage(`Leaderboard reward claimed: ${prize} coins!`);
  };

  const nextLevel = () => {
    if (dailyMode) {
      setScreen("home");
      return;
    }
    if (activeLevel < levelCount) startLevel(activeLevel + 1);
    else setScreen("levels");
  };

  if (!loaded) {
    return <main className="loading">🐦<h2>Loading Slingshot Adventures...</h2></main>;
  }

  const myRank = leaders.findIndex((entry) => entry.user_id === myUserId) + 1;

  return (
    <main className="app">
      <aside className="sidebar">
        <Link href="/" className="brand"><span>🎮</span> Keith&apos;s Games</Link>
        <div className="nav-label">SLINGSHOT ADVENTURES</div>
        {[
          ["home", "⌂", "Dashboard"],
          ["levels", "▦", "Levels"],
          ["daily", "📅", "Daily challenge"],
          ["shop", "🛍️", "Coin shop"],
          ["slingshots", "⭐", "Slingshots"],
          ["powerups", "⚡", "Power-ups"],
          ["leaderboard", "🏆", "Leaderboard"],
          ["rewards", "🎁", "Daily rewards"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            className={`nav-button ${screen === id ? "active" : ""}`}
            onClick={() => setScreen(id)}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
        <div className="sidebar-player"><span>K</span><div><strong>Keith</strong><small>Player</small></div></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div><div className="eyebrow">YOUR ARCADE</div><h1>Slingshot Adventures</h1></div>
          <div className="balances">
            <span>🪙 {coins.toLocaleString()}</span>
            <span>⭐ {stars.toLocaleString()}</span>
            <small>{saving ? "Saving..." : "● Saved"}</small>
          </div>
        </header>

        {screen === "home" && (
          <>
            <section className="hero">
              <div>
                <span className="hero-tag">🐦 THE ADVENTURE STARTS HERE</span>
                <h2>Ready, aim, <em>launch!</em></h2>
                <p>Hit the targets, complete challenges and build your collection.</p>
                <button className="primary" onClick={() => startLevel(unlockedLevels)}>Play level {unlockedLevels} →</button>
              </div>
              <div className="hero-art">🎯</div>
            </section>
            <div className="stats">
              <div><span>🏆</span><strong>{completedLevels.length}/{levelCount}</strong><small>Levels completed</small></div>
              <div><span>🪙</span><strong>{coins.toLocaleString()}</strong><small>Coins collected</small></div>
              <div><span>⭐</span><strong>{stars}</strong><small>Stars collected</small></div>
              <div><span>🔥</span><strong>{dailyStreak}</strong><small>Daily streak</small></div>
            </div>
            <div className="section-title"><div><small>COME BACK EVERY DAY</small><h2>Daily activities</h2></div></div>
            <div className="feature-grid">
              <button className="feature-card" onClick={() => setScreen("daily")}><span>📅</span><strong>Daily challenge</strong><small>{dailyChallengeDate === today ? "Completed today" : "Earn bonus coins and stars"}</small></button>
              <button className="feature-card" onClick={() => setScreen("rewards")}><span>🎁</span><strong>Daily reward</strong><small>{dailyRewardDate === today ? "Come back tomorrow" : "Your reward is ready"}</small></button>
              <button className="feature-card" onClick={() => setScreen("leaderboard")}><span>🏆</span><strong>Leaderboard</strong><small>{myRank ? `Your rank: #${myRank}` : "Get on the leaderboard"}</small></button>
            </div>
            <div className="section-title"><div><small>KEEP PLAYING</small><h2>Your levels</h2></div><button className="text-button" onClick={() => setScreen("levels")}>View all →</button></div>
            <div className="quick-levels">
              {[1, 2, 3].map((level) => (
                <button key={level} disabled={level > unlockedLevels} onClick={() => startLevel(level)}>
                  <span>{completedLevels.includes(level) ? "🏆" : level > unlockedLevels ? "🔒" : "🎯"}</span>
                  <strong>Level {level}</strong>
                  <small>{completedLevels.includes(level) ? "Completed" : level > unlockedLevels ? "Locked" : "Play now"}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {screen === "levels" && (
          <section className="page-section">
            <div className="section-title"><div><small>YOUR JOURNEY</small><h2>Choose a level</h2><p>Complete levels to unlock the next one.</p></div></div>
            <div className="level-grid">
              {Array.from({ length: levelCount }, (_, index) => {
                const level = index + 1;
                const locked = level > unlockedLevels;
                const done = completedLevels.includes(level);
                return <button key={level} disabled={locked} className={done ? "completed" : ""} onClick={() => startLevel(level)}>
                  <span>{locked ? "🔒" : done ? "🏆" : "🎯"}</span><strong>Level {level}</strong><small>{locked ? "Locked" : done ? "Completed" : "Available"}</small>
                  {bestScores[level] ? <small>{bestScores[level]} pts</small> : null}
                </button>;
              })}
            </div>
          </section>
        )}

        {screen === "daily" && (
          <section className="page-section">
            <div className="section-title"><div><small>CHANGES EVERY DAY</small><h2>Daily challenge</h2><p>One special challenge each day. Complete it for extra rewards.</p></div></div>
            <div className="daily-card">
              <span className="daily-icon">🌟</span><h2>Daily target challenge</h2>
              <p>Hit today&apos;s target to earn 100 bonus coins and 2 stars.</p>
              <div className="daily-date">Challenge date: {today}</div>
              {dailyChallengeDate === today
                ? <div className="claimed">✓ Completed for today. Come back tomorrow.</div>
                : <button className="primary" onClick={() => startLevel(((new Date().getUTCDate() - 1) % levelCount) + 1, true)}>Play today&apos;s challenge →</button>}
            </div>
          </section>
        )}

        {screen === "rewards" && (
          <section className="page-section">
            <div className="section-title"><div><small>DAILY BONUS</small><h2>Daily rewards</h2><p>Collect a reward every day. Your streak builds extra rewards.</p></div></div>
            <div className="reward-card">
              <span className="daily-icon">🎁</span><h2>{dailyRewardDate === today ? "Reward collected" : "Your daily reward is ready"}</h2>
              <p>Collect coins and a star. Every seventh day gives you three stars.</p>
              <div className="streak">🔥 {dailyStreak} day streak</div>
              <button className="primary" disabled={dailyRewardDate === today} onClick={claimDailyReward}>
                {dailyRewardDate === today ? "Come back tomorrow" : "Collect today's reward"}
              </button>
            </div>
            <div className="reward-days">
              {Array.from({ length: 7 }, (_, i) => <div key={i} className={i + 1 <= dailyStreak % 8 ? "day-done" : ""}><span>{i === 6 ? "⭐" : "🪙"}</span><strong>Day {i + 1}</strong><small>{i === 6 ? "3 stars" : `${50 + i * 10} coins`}</small></div>)}
            </div>
          </section>
        )}

        {screen === "shop" && (
          <section className="page-section">
            <div className="section-title"><div><small>SPEND YOUR COINS</small><h2>Power-up shop</h2><p>Buy boosts to help with your next shot.</p></div><span className="balance-label">🪙 {coins} coins</span></div>
            <div className="shop-grid">
              {(Object.keys(powerInfo) as Power[]).map((power) => {
                const item = powerInfo[power];
                return <div className="shop-card" key={power}><span>{item.emoji}</span><h3>{item.name}</h3><p>{item.description}</p><small>Owned: {powerups[power]}</small><button disabled={coins < item.price} onClick={() => buyPower(power)}>🪙 {item.price} · Buy</button></div>;
              })}
            </div>
          </section>
        )}

        {screen === "slingshots" && (
          <section className="page-section">
            <div className="section-title"><div><small>STAR COLLECTION</small><h2>Slingshot collection</h2><p>Use stars to unlock different slingshot designs.</p></div><span className="balance-label">⭐ {stars} stars</span></div>
            <div className="shop-grid">
              {skins.map((skin) => {
                const owned = unlockedSkins.includes(skin.id);
                return <div className="shop-card" key={skin.id}><span style={{ color: skin.colour }}>{skin.emoji}</span><h3>{skin.name}</h3><p>{skin.id === "classic" ? "The original slingshot." : "A new look for your launcher."}</p><button disabled={!owned && stars < skin.stars} onClick={() => buySkin(skin)}>{selectedSkin === skin.id ? "✓ Equipped" : owned ? "Equip" : `⭐ ${skin.stars} stars`}</button></div>;
              })}
            </div>
          </section>
        )}

        {screen === "powerups" && (
          <section className="page-section">
            <div className="section-title"><div><small>YOUR INVENTORY</small><h2>Power-ups</h2><p>Select one before launching. Each power-up is used once.</p></div></div>
            <div className="shop-grid">
              {(Object.keys(powerInfo) as Power[]).map((power) => <button key={power} className={`shop-card power-choice ${activePower === power ? "chosen" : ""}`} disabled={powerups[power] < 1} onClick={() => setActivePower(activePower === power ? null : power)}><span>{powerInfo[power].emoji}</span><h3>{powerInfo[power].name}</h3><p>{powerInfo[power].description}</p><small>Owned: {powerups[power]}</small><strong>{activePower === power ? "Selected ✓" : "Select power-up"}</strong></button>)}
            </div>
            <button className="secondary" onClick={() => setScreen("shop")}>Visit power-up shop →</button>
          </section>
        )}

        {screen === "leaderboard" && (
          <section className="page-section">
            <div className="section-title"><div><small>GLOBAL SCORES</small><h2>Leaderboard</h2><p>Players are ranked by their highest recorded score.</p></div><button className="secondary" onClick={loadLeaderboard}>↻ Refresh</button></div>
            <div className="leader-profile">
              <label htmlFor="player-name">Your display name</label>
              <input id="player-name" maxLength={18} value={playerName} onChange={(event) => setPlayerName(event.target.value)} onBlur={() => persist()} />
              <span>{myRank ? `Your current position: #${myRank}` : "Play a level to join the leaderboard."}</span>
            </div>
            <div className="leader-list">
              {leaders.length === 0 ? <p>No scores yet. Complete a level to be first on the board.</p> : leaders.map((leader, index) => <div className={`leader-row ${leader.user_id === myUserId ? "mine" : ""}`} key={leader.user_id}><strong className="rank">{index + 1}</strong><span className="leader-avatar">{index === 0 ? "👑" : "🎮"}</span><div><strong>{leader.player_name}</strong><small>{leader.levels_completed} levels completed</small></div><b>{Number(leader.total_score).toLocaleString()} pts</b></div>)}
            </div>
            <div className="leader-prize"><h3>Daily leaderboard reward</h3><p>1st: 250 coins · Top 3: 150 coins · Top 10: 75 coins · Other ranked players: 25 coins.</p><button className="primary" disabled={leaderRewardDate === today || !myRank} onClick={claimLeaderboardReward}>{leaderRewardDate === today ? "Claimed today" : "Claim rank reward"}</button><small>Reward can be claimed once per day, based on the displayed leaderboard position.</small></div>
          </section>
        )}

        {screen === "game" && (
          <section className="play-section">
            <div className="section-title"><div><small>{dailyMode ? "DAILY CHALLENGE" : "SLINGSHOT CHALLENGE"}</small><h2>{dailyMode ? "Daily target" : `Level ${activeLevel}`}</h2></div><span className="balance-label">🪙 {coins}</span></div>
            <div className="game-stats"><span>🎯 {shots} shots</span><span>⭐ {score} points</span><span>⚡ {activePower ? powerInfo[activePower].name : "No power-up"}</span></div>
            <div className="game-board">
              <svg ref={svgRef} viewBox="0 0 800 450" className="game-svg" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={launch} onPointerCancel={launch}>
                <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9bd8f8" /><stop offset="100%" stopColor="#e5f6ff" /></linearGradient></defs>
                <rect width="800" height="450" fill="url(#sky)" />
                <circle cx="680" cy="75" r="36" fill="#ffe49a" />
                <path d="M0 350 Q180 300 350 355 T800 340 V450 H0Z" fill="#a7d58a" />
                <path d="M0 385 Q250 345 500 390 T800 370 V450 H0Z" fill="#75b96c" />
                <rect x="580" y="315" width="18" height="85" rx="4" fill="#9c7046" />
                <rect x="680" y="315" width="18" height="85" rx="4" fill="#9c7046" />
                <rect x="575" y="300" width="128" height="15" rx="5" fill="#b98b5c" />
                <g>
                  <circle cx={600 - (activeLevel - 1) * 12} cy="270" r="32" fill="#e95c5c" />
                  <circle cx={600 - (activeLevel - 1) * 12} cy="270" r="19" fill="#fff" />
                  <circle cx={600 - (activeLevel - 1) * 12} cy="270" r="9" fill="#e95c5c" />
                </g>
                <path d="M125 390 L145 310 L170 390" fill="none" stroke="#80502f" strokeWidth="16" strokeLinecap="round" />
                {dragging && <line x1="145" y1="310" x2={projectile.x} y2={projectile.y} stroke="#75502e" strokeWidth="8" strokeLinecap="round" />}
                <path d={`M125 390 Q135 350 ${projectile.x} ${projectile.y}`} fill="none" stroke={currentSkin.colour} strokeWidth="7" strokeLinecap="round" />
                <circle cx={projectile.x} cy={projectile.y} r="21" fill={currentSkin.colour} stroke="#fff" strokeWidth="3" />
                <text x={projectile.x} y={projectile.y + 8} textAnchor="middle" fontSize="24">🐦</text>
                {dragging && <line x1={projectile.x} y1={projectile.y} x2={projectile.x + (150 - projectile.x) * 2} y2={projectile.y + (310 - projectile.y) * 2} stroke="#334155" strokeDasharray="7 7" strokeWidth="2" opacity="0.5" />}
              </svg>
              <div className="game-message">{message}</div>
            </div>
            <div className="game-controls">
              <button className="secondary" onClick={resetShot}>↻ Reset shot</button>
              <button className="secondary" onClick={() => setScreen("levels")}>Exit level</button>
              <span>Drag the bird backwards and release to launch.</span>
            </div>
            {levelWon && <div className="win-panel"><span>🏆</span><h2>Level completed!</h2><p>You scored {score.toLocaleString()} points.</p><strong>🪙 +{reward} coins</strong>{dailyMode && dailyChallengeDate === today && <p>⭐ +2 stars for the daily challenge</p>}<div><button className="secondary" onClick={() => setScreen("levels")}>Levels</button><button className="primary" onClick={nextLevel}>{dailyMode ? "Back to dashboard" : activeLevel === levelCount ? "Finish" : "Next level →"}</button></div></div>}
          </section>
        )}

        <footer className="footer"><span>Keith&apos;s Games</span><span>Slingshot Adventures</span></footer>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .app { min-height:100vh; display:flex; background:#101521; color:#f4f6fb; font-family:Arial, sans-serif; }
        button,input { font:inherit; }
        button { cursor:pointer; }
        button:disabled { opacity:.4; cursor:not-allowed; }
        .sidebar { width:225px; flex-shrink:0; min-height:100vh; height:100vh; position:sticky; top:0; display:flex; flex-direction:column; padding:23px 15px; background:#171e2c; border-right:1px solid #293246; }
        .brand { display:flex; align-items:center; gap:10px; margin:0 4px 38px; color:white; text-decoration:none; font-size:15px; font-weight:800; }
        .brand span { display:grid; place-items:center; width:36px; height:36px; border-radius:11px; background:#6553bb; font-size:19px; }
        .nav-label,.eyebrow,.section-title small { color:#8491a7; font-size:9px; font-weight:800; letter-spacing:1.3px; }
        .nav-label { margin:0 9px 12px; }
        .nav-button { display:flex; align-items:center; gap:11px; width:100%; border:0; border-radius:8px; padding:11px 10px; margin-bottom:3px; background:transparent; color:#aeb9cc; text-align:left; font-size:12px; }
        .nav-button span { width:19px; text-align:center; }
        .nav-button.active,.nav-button:hover { color:white; background:#2b2a45; }
        .sidebar-player { margin-top:auto; padding:17px 4px 0; border-top:1px solid #303a4d; display:flex; align-items:center; gap:10px; }
        .sidebar-player>span { width:35px; height:35px; display:grid; place-items:center; border-radius:50%; background:#3d806d; font-weight:800; }
        .sidebar-player strong,.sidebar-player small { display:block; }
        .sidebar-player strong { font-size:12px; }
        .sidebar-player small { color:#8d9ab0; margin-top:3px; font-size:10px; }
        .main { flex:1; min-width:0; padding:26px 32px 20px; }
        .topbar { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-bottom:25px; }
        h1 { font-size:23px; margin:6px 0 0; }
        h2 { margin:5px 0 0; font-size:20px; }
        .balances { display:flex; align-items:center; gap:13px; }
        .balances span,.balance-label { border:1px solid #4b442e; background:#282519; color:#f3d47b; padding:9px 12px; border-radius:9px; font-size:12px; font-weight:800; }
        .balances small { color:#76c89c; font-size:10px; }
        .hero { min-height:205px; display:flex; align-items:center; justify-content:space-between; padding:30px 35px; border-radius:17px; background:linear-gradient(110deg,#382c68,#59418b 58%,#8a5d9d); overflow:hidden; }
        .hero-tag { color:#d5c9ff; font-size:9px; font-weight:800; letter-spacing:1px; }
        .hero h2 { margin:13px 0 8px; font-size:clamp(27px,4vw,38px); }
        .hero h2 em { color:#f7d579; font-style:normal; }
        .hero p { color:#ded7f2; font-size:12px; margin:0 0 18px; }
        .hero-art { font-size:100px; margin-right:35px; }
        .primary,.secondary { border:0; border-radius:8px; padding:11px 15px; font-size:11px; font-weight:800; }
        .primary { background:#f1cc70; color:#292013; }
        .secondary { background:#303b50; color:white; }
        .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:18px; }
        .stats>div { background:#192231; border:1px solid #2b3548; border-radius:11px; padding:14px; }
        .stats span,.stats strong,.stats small { display:block; }
        .stats span { font-size:19px; margin-bottom:9px; }
        .stats strong { font-size:21px; }
        .stats small { color:#929fb3; font-size:10px; margin-top:4px; }
        .section-title { display:flex; justify-content:space-between; align-items:center; gap:15px; margin:28px 0 14px; }
        .section-title h2 { font-size:19px; }
        .section-title p { color:#98a4b8; font-size:11px; margin:6px 0 0; }
        .text-button { border:0; background:transparent; color:#b7a5ff; font-size:11px; }
        .feature-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .feature-card { text-align:left; border:1px solid #30394b; border-radius:11px; padding:15px; background:#192231; color:white; }
        .feature-card span,.feature-card strong,.feature-card small { display:block; }
        .feature-card span { font-size:23px; margin-bottom:10px; }
        .feature-card strong { font-size:12px; }
        .feature-card small { color:#9aa6b9; font-size:10px; margin-top:5px; }
        .quick-levels { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .quick-levels button { display:grid; grid-template-columns:35px 1fr; grid-template-rows:auto auto; text-align:left; gap:4px 9px; align-items:center; padding:13px; border:1px solid #30394b; border-radius:10px; background:#192231; color:white; }
        .quick-levels button span { grid-row:1/3; font-size:22px; }
        .quick-levels strong { font-size:11px; }
        .quick-levels small { color:#9aa6b9; font-size:10px; }
        .page-section { max-width:1050px; }
        .level-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
        .level-grid button { min-height:125px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; border:1px solid #30394b; border-radius:11px; background:#192231; color:white; }
        .level-grid button.completed { border-color:#658e78; background:#1d302c; }
        .level-grid button span { font-size:25px; }
        .level-grid button strong { font-size:12px; }
        .level-grid button small { color:#9ba5b8; font-size:10px; }
        .daily-card,.reward-card { max-width:600px; padding:30px; text-align:center; border:1px solid #3a4054; border-radius:15px; background:#1a2232; }
        .daily-icon { font-size:55px; }
        .daily-card h2,.reward-card h2 { margin:12px 0; }
        .daily-card p,.reward-card p { color:#aab5c8; font-size:12px; line-height:1.6; }
        .daily-date,.streak { margin:16px 0; color:#f1d17b; font-size:12px; }
        .claimed { color:#8bd5a9; font-size:12px; margin-top:15px; }
        .reward-days { display:grid; grid-template-columns:repeat(7,1fr); gap:9px; margin-top:18px; max-width:700px; }
        .reward-days div { display:grid; justify-items:center; gap:6px; padding:13px 5px; background:#1b2433; border:1px solid #30394b; border-radius:9px; }
        .reward-days span { font-size:20px; }
        .reward-days strong,.reward-days small { font-size:9px; }
        .reward-days small { color:#a3aec0; }
        .reward-days .day-done { border-color:#6b9a7c; }
        .shop-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:18px; }
        .shop-card { display:flex; flex-direction:column; align-items:center; text-align:center; padding:19px; background:#1a2232; border:1px solid #30394b; border-radius:12px; color:white; }
        .shop-card>span { font-size:39px; margin-bottom:10px; }
        .shop-card h3 { font-size:13px; margin:0 0 7px; }
        .shop-card p { min-height:30px; color:#9da9bc; font-size:10px; line-height:1.5; }
        .shop-card small { color:#e7cb80; font-size:10px; margin:3px 0 12px; }
        .shop-card button,.shop-card>strong { width:100%; border:0; border-radius:8px; padding:10px; background:#7059cb; color:white; font-size:10px; font-weight:800; }
        .power-choice { cursor:pointer; }
        .power-choice.chosen { border-color:#a28cff; background:#292545; }
        .balance-label { white-space:nowrap; }
        .leader-profile { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:15px; border:1px solid #30394b; border-radius:10px; background:#1a2232; }
        .leader-profile label { color:#aab5c8; font-size:11px; }
        .leader-profile input { width:160px; padding:9px; border:1px solid #46516a; border-radius:7px; background:#101825; color:white; }
        .leader-profile span { color:#aab5c8; font-size:10px; }
        .leader-list { margin-top:15px; border:1px solid #30394b; border-radius:11px; overflow:hidden; }
        .leader-list>p { padding:20px; color:#aab5c8; font-size:12px; }
        .leader-row { display:flex; align-items:center; gap:13px; padding:12px 15px; background:#1a2232; border-bottom:1px solid #30394b; }
        .leader-row:last-child { border:0; }
        .leader-row.mine { background:#292545; }
        .rank { width:22px; color:#e5cb7d; font-size:13px; }
        .leader-avatar { width:32px; height:32px; display:grid; place-items:center; border-radius:50%; background:#30394b; }
        .leader-row div { flex:1; }
        .leader-row div strong,.leader-row div small { display:block; }
        .leader-row div strong { font-size:11px; }
        .leader-row div small { color:#9da9bc; font-size:9px; margin-top:4px; }
        .leader-row>b { color:#f0d17a; font-size:11px; }
        .leader-prize { margin-top:15px; padding:17px; border:1px solid #51462d; border-radius:10px; background:#282519; }
        .leader-prize h3 { margin:0 0 7px; font-size:13px; }
        .leader-prize p,.leader-prize small { color:#c2b99f; font-size:10px; line-height:1.6; }
        .leader-prize small { display:block; margin-top:9px; }
        .play-section { max-width:1000px; }
        .game-stats { display:flex; gap:10px; margin:15px 0; flex-wrap:wrap; }
        .game-stats span { padding:9px 12px; background:#202b3c; border-radius:8px; font-size:10px; }
        .game-board { overflow:hidden; border:1px solid #3b4356; border-radius:13px; background:#b8e6f9; }
        .game-svg { display:block; width:100%; touch-action:none; cursor:crosshair; }
        .game-message { padding:10px; background:#171c2be8; color:white; text-align:center; font-size:11px; }
        .game-controls { display:flex; align-items:center; gap:9px; margin-top:13px; flex-wrap:wrap; }
        .game-controls>span { margin-left:auto; color:#9da9bc; font-size:10px; }
        .win-panel { margin-top:17px; padding:22px; text-align:center; border:1px solid #648a70; border-radius:12px; background:#20372d; }
        .win-panel>span { font-size:35px; }
        .win-panel h2 { margin:8px 0; }
        .win-panel p { color:#b5c9ba; font-size:11px; }
        .win-panel>strong { display:block; margin:13px; color:#f4d47b; }
        .win-panel>div { display:flex; justify-content:center; gap:10px; }
        .footer { display:flex; justify-content:space-between; margin-top:30px; padding-top:15px; border-top:1px solid #293448; color:#7f8ba0; font-size:10px; }
        .loading { min-height:100vh; display:grid; place-content:center; text-align:center; background:#101521; color:white; }
        @media(max-width:1000px) { .sidebar { width:190px; } .main { padding:22px; } .level-grid { grid-template-columns:repeat(4,1fr); } }
        @media(max-width:760px) { .sidebar { width:62px; padding:15px 7px; } .brand { justify-content:center; margin:0 0 25px; } .brand:not(span) { font-size:0; } .brand span { font-size:19px; } .nav-label { display:none; } .nav-button { justify-content:center; font-size:0; padding:12px 4px; } .nav-button span { font-size:17px; } .sidebar-player { justify-content:center; } .sidebar-player div { display:none; } .stats { grid-template-columns:repeat(2,1fr); } .shop-grid { grid-template-columns:repeat(2,1fr); } .level-grid { grid-template-columns:repeat(3,1fr); } .hero-art { font-size:65px; margin:0; } }
        @media(max-width:520px) { .main { padding:16px 11px; } .topbar { align-items:flex-start; flex-direction:column; } .balances { width:100%; justify-content:flex-start; } .hero { padding:23px 19px; } .hero-art { font-size:48px; } .hero p { max-width:230px; line-height:1.5; } .feature-grid,.quick-levels { grid-template-columns:1fr; } .shop-grid { grid-template-columns:1fr 1fr; gap:8px; } .shop-card { padding:12px 8px; } .shop-card>span { font-size:30px; } .level-grid { grid-template-columns:repeat(2,1fr); } .reward-days { grid-template-columns:repeat(4,1fr); } .game-controls>span { width:100%; margin:4px 0; } .footer { flex-direction:column; gap:7px; } }
      `}</style>
    </main>
  );
}
