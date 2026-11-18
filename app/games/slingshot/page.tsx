"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Screen = "home" | "levels" | "game" | "shop";
type Powerup = "heavy" | "blast" | "multi";

type Block = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  material: "wood" | "stone" | "glass";
  hp: number;
  vx: number;
  vy: number;
  angle: number;
  falling: boolean;
};

type Pig = {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  vx: number;
  vy: number;
};

type World = {
  blocks: Block[];
  pigs: Pig[];
  particles: { x: number; y: number; life: number; colour: string }[];
};

type SavedData = {
  coins?: number;
  unlockedLevels?: number;
  completedLevels?: number[];
  unlockedSkins?: string[];
  selectedSkin?: string;
  bestScores?: Record<number, number>;
  powerups?: Record<Powerup, number>;
};

const levelCount = 10;

const skins = [
  { id: "classic", name: "Classic", emoji: "🐦", price: 0, colour: "#d85d45" },
  { id: "gold", name: "Golden", emoji: "🐤", price: 150, colour: "#f5c542" },
  { id: "ice", name: "Frost", emoji: "🐧", price: 250, colour: "#62c9ed" },
  { id: "fire", name: "Inferno", emoji: "🔥", price: 350, colour: "#ff714d" },
  { id: "neon", name: "Neon", emoji: "💜", price: 500, colour: "#b58aff" },
  { id: "nature", name: "Nature", emoji: "🌿", price: 650, colour: "#63c985" },
];

const powerupInfo: {
  id: Powerup;
  name: string;
  emoji: string;
  price: number;
  description: string;
}[] = [
  {
    id: "heavy",
    name: "Heavy bird",
    emoji: "💪",
    price: 60,
    description: "A heavier bird that hits blocks with extra force.",
  },
  {
    id: "blast",
    name: "Explosion",
    emoji: "💥",
    price: 90,
    description: "Creates a powerful explosion around the impact.",
  },
  {
    id: "multi",
    name: "Triple shot",
    emoji: "🐦",
    price: 120,
    description: "Launches three birds in a spread.",
  },
];

const initialPowerups: Record<Powerup, number> = {
  heavy: 2,
  blast: 1,
  multi: 1,
};

function makeWorld(level: number): World {
  const base = 350;
  const offset = Math.min(level - 1, 8) * 9;

  const blocks: Block[] = [];
  let id = 0;

  const add = (
    x: number,
    y: number,
    w: number,
    h: number,
    material: Block["material"]
  ) => {
    blocks.push({
      id: id++,
      x,
      y,
      w,
      h,
      material,
      hp: material === "stone" ? 3 : material === "glass" ? 1 : 2,
      vx: 0,
      vy: 0,
      angle: 0,
      falling: false,
    });
  };

  // Main building
  const left = 510 - offset;
  const right = 660 - offset;

  add(left, base - 12, 150, 12, "stone");
  add(left + 8, base - 55, 15, 43, "wood");
  add(right - 23, base - 55, 15, 43, "wood");
  add(left + 23, base - 55, 104, 12, "wood");
  add(left + 25, base - 95, 12, 40, "glass");
  add(right - 37, base - 95, 12, 40, "glass");
  add(left + 37, base - 95, 76, 12, "wood");
  add(left + 48, base - 135, 12, 40, "wood");
  add(right - 60, base - 135, 12, 40, "wood");
  add(left + 60, base - 135, 30, 12, "stone");

  // Extra side structure
  if (level >= 2) {
    add(left - 90, base - 12, 80, 12, "stone");
    add(left - 82, base - 52, 12, 40, "wood");
    add(left - 25, base - 52, 12, 40, "wood");
    add(left - 70, base - 64, 45, 12, "glass");
  }

  // Upper platform
  if (level >= 4) {
    add(left + 35, base - 180, 105, 12, "stone");
    add(left + 48, base - 220, 12, 40, "wood");
    add(right - 60, base - 220, 12, 40, "wood");
    add(left + 60, base - 232, 30, 12, "glass");
  }

  // More complicated tower
  if (level >= 7) {
    add(right + 35, base - 12, 65, 12, "stone");
    add(right + 40, base - 55, 12, 43, "wood");
    add(right + 85, base - 55, 12, 43, "wood");
    add(right + 52, base - 67, 34, 12, "glass");
  }

  const pigs: Pig[] = [
    { id: 1, x: left + 75, y: base - 28, alive: true, vx: 0, vy: 0 },
  ];

  if (level >= 3) {
    pigs.push({
      id: 2,
      x: left + 75,
      y: base - 112,
      alive: true,
      vx: 0,
      vy: 0,
    });
  }

  if (level >= 6) {
    pigs.push({
      id: 3,
      x: right + 65,
      y: base - 28,
      alive: true,
      vx: 0,
      vy: 0,
    });
  }

  return { blocks, pigs, particles: [] };
}

export default function SlingshotPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldRef = useRef<World>(makeWorld(1));
  const projectileRef = useRef({ x: 150, y: 310 });
  const shotsRef = useRef(0);
  const scoreRef = useRef(0);
  const wonRef = useRef(false);

  const [screen, setScreen] = useState<Screen>("home");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [coins, setCoins] = useState(0);
  const [unlockedLevels, setUnlockedLevels] = useState(1);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(["classic"]);
  const [selectedSkin, setSelectedSkin] = useState("classic");
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [powerups, setPowerups] = useState<Record<Powerup, number>>(initialPowerups);

  const [activeLevel, setActiveLevel] = useState(1);
  const [world, setWorld] = useState<World>(makeWorld(1));
  const [projectile, setProjectile] = useState({ x: 150, y: 310 });
  const [dragging, setDragging] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [shots, setShots] = useState(0);
  const [score, setScore] = useState(0);
  const [levelWon, setLevelWon] = useState(false);
  const [message, setMessage] = useState("Pull the bird backwards and release!");
  const [selectedPowerup, setSelectedPowerup] = useState<Powerup | null>(null);
  const [shopTab, setShopTab] = useState<"birds" | "powerups">("powerups");
  const [shake, setShake] = useState(false);

  const currentSkin = skins.find((s) => s.id === selectedSkin) ?? skins[0];

  const persist = useCallback(async (data: SavedData) => {
    try {
      setSaving(true);
      await saveGame("slingshot", data);
    } catch (error) {
      console.error("Could not save game:", error);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = (await loadGameSave("slingshot")) as SavedData | null;
        if (!active) return;

        if (data) {
          setCoins(data.coins ?? 0);
          setUnlockedLevels(data.unlockedLevels ?? 1);
          setCompletedLevels(data.completedLevels ?? []);
          setUnlockedSkins(data.unlockedSkins ?? ["classic"]);
          setSelectedSkin(data.selectedSkin ?? "classic");
          setBestScores(data.bestScores ?? {});
          setPowerups({ ...initialPowerups, ...(data.powerups ?? {}) });
        }
      } catch (error) {
        console.error("Could not load game:", error);
      } finally {
        if (active) setLoaded(true);
      }
    }

    load();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      persist({
        coins,
        unlockedLevels,
        completedLevels,
        unlockedSkins,
        selectedSkin,
        bestScores,
        powerups,
      });
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    loaded,
    coins,
    unlockedLevels,
    completedLevels,
    unlockedSkins,
    selectedSkin,
    bestScores,
    powerups,
    persist,
  ]);

  const updateWorld = (next: World) => {
    worldRef.current = next;
    setWorld({ ...next });
  };

  const stopPhysics = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const resetShot = () => {
    stopPhysics();
    projectileRef.current = { x: 150, y: 310 };
    setProjectile({ x: 150, y: 310 });
    setDragging(false);
    setLaunched(false);
  };

  const startLevel = (level: number) => {
    if (level > unlockedLevels) return;
    stopPhysics();

    const next = makeWorld(level);
    worldRef.current = next;
    setWorld(next);
    setActiveLevel(level);
    setShots(0);
    setScore(0);
    shotsRef.current = 0;
    scoreRef.current = 0;
    wonRef.current = false;
    setLevelWon(false);
    setSelectedPowerup(null);
    resetShot();
    setMessage("Knock down the buildings and defeat every target!");
    setScreen("game");
  };

  const getPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 150, y: 310 };

    return {
      x: ((event.clientX - rect.left) / rect.width) * 800,
      y: ((event.clientY - rect.top) / rect.height) * 450,
    };
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (launched || levelWon) return;

    const p = getPosition(event);
    if (Math.hypot(p.x - projectile.x, p.y - projectile.y) < 65) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || launched) return;

    const p = getPosition(event);
    const dx = p.x - 150;
    const dy = p.y - 310;
    const length = Math.hypot(dx, dy);
    const max = 100;
    const scale = length > max ? max / length : 1;
    const next = { x: 150 + dx * scale, y: 310 + dy * scale };

    projectileRef.current = next;
    setProjectile(next);
  };

  const addParticles = (
    particles: World["particles"],
    x: number,
    y: number,
    colour: string
  ) => {
    for (let i = 0; i < 9; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 25,
        y: y + (Math.random() - 0.5) * 20,
        life: 1,
        colour,
      });
    }
  };

  const checkWin = (next: World) => {
    const alive = next.pigs.some((pig) => pig.alive);
    if (alive || wonRef.current) return;

    wonRef.current = true;
    setLevelWon(true);
    setLaunched(false);

    const first = !completedLevels.includes(activeLevel);
    const earned = (first ? 40 : 0) + (scoreRef.current >= 1500 ? 25 : 10);

    setCoins((v) => v + earned);
    setCompletedLevels((v) =>
      v.includes(activeLevel) ? v : [...v, activeLevel]
    );
    setUnlockedLevels((v) => Math.max(v, Math.min(levelCount, activeLevel + 1)));
    setBestScores((v) => ({
      ...v,
      [activeLevel]: Math.max(v[activeLevel] ?? 0, scoreRef.current),
    }));
    setMessage(`Level complete! You earned ${earned} coins.`);
  };

  const launch = () => {
    if (!dragging || launched || levelWon) return;

    setDragging(false);
    setLaunched(true);

    const dx = 150 - projectile.x;
    const dy = 310 - projectile.y;
    const strength = Math.hypot(dx, dy);
    let x = projectile.x;
    let y = projectile.y;
    let vx = dx * (selectedPowerup === "heavy" ? 0.23 : 0.18);
    let vy = dy * (selectedPowerup === "heavy" ? 0.23 : 0.18);

    shotsRef.current += 1;
    setShots(shotsRef.current);

    const power = selectedPowerup;
    if (power) {
      setPowerups((v) => ({ ...v, [power]: Math.max(0, v[power] - 1) }));
      setSelectedPowerup(null);
    }

    const birdRadius = power === "heavy" ? 19 : 13;
    let blastDone = false;
    let tripleBirds: { x: number; y: number; vx: number; vy: number }[] = [];

    if (power === "multi") {
      tripleBirds = [
        { x, y, vx, vy },
        { x, y: y - 8, vx: vx * 0.93, vy: vy - 1.4 },
        { x, y: y + 8, vx: vx * 1.04, vy: vy + 1.4 },
      ];
    }

    setMessage("Direct hit! Watch the structure collapse.");

    timerRef.current = setInterval(() => {
      const next = worldRef.current;
      const birds = power === "multi"
        ? tripleBirds
        : [{ x, y, vx, vy }];

      for (const bird of birds) {
        bird.x += bird.vx;
        bird.y += bird.vy;
        bird.vy += 0.34;
        bird.vx *= 0.997;

        for (const block of next.blocks) {
          if (block.hp <= 0) continue;

          const hit =
            bird.x + birdRadius > block.x &&
            bird.x - birdRadius < block.x + block.w &&
            bird.y + birdRadius > block.y &&
            bird.y - birdRadius < block.y + block.h;

          if (hit) {
            const damage = power === "heavy" ? 3 : 1;
            block.hp -= damage;
            block.falling = true;
            block.vx += bird.vx * 0.23;
            block.vy -= Math.max(1.5, Math.abs(bird.vy) * 0.4);
            addParticles(
              next.particles,
              bird.x,
              bird.y,
              block.material === "glass" ? "#9ce8ff" :
              block.material === "stone" ? "#9ca3af" : "#c58a50"
            );

            scoreRef.current += block.hp <= 0 ? 180 : 60;
            setScore(scoreRef.current);

            if (block.hp <= 0) {
              addParticles(next.particles, block.x + block.w / 2, block.y + block.h / 2, "#d7b58c");
            }

            if (power === "blast" && !blastDone) {
              blastDone = true;
              setShake(true);
              setTimeout(() => setShake(false), 250);

              for (const nearby of next.blocks) {
                const distance = Math.hypot(
                  nearby.x + nearby.w / 2 - bird.x,
                  nearby.y + nearby.h / 2 - bird.y
                );
                if (distance < 125) {
                  nearby.hp -= 2;
                  nearby.falling = true;
                  nearby.vx += (nearby.x - bird.x) * 0.045;
                  nearby.vy -= 5;
                  if (nearby.hp <= 0) {
                    addParticles(next.particles, nearby.x, nearby.y, "#e9a66d");
                  }
                }
              }

              for (const pig of next.pigs) {
                if (pig.alive && Math.hypot(pig.x - bird.x, pig.y - bird.y) < 145) {
                  pig.alive = false;
                  scoreRef.current += 500;
                }
              }
            }

            bird.x = 900;
            break;
          }
        }

        for (const pig of next.pigs) {
          if (pig.alive && Math.hypot(pig.x - bird.x, pig.y - bird.y) < 25) {
            pig.alive = false;
            scoreRef.current += 500;
            addParticles(next.particles, pig.x, pig.y, "#8ee28c");
            bird.x = 900;
          }
        }
      }

      // Falling blocks collide with the ground and other blocks.
      for (const block of next.blocks) {
        if (block.hp <= 0) continue;

        if (block.falling) {
          block.vy += 0.42;
          block.x += block.vx;
          block.y += block.vy;
          block.vx *= 0.985;
          block.angle += block.vx * 0.012;

          if (block.y + block.h >= 350) {
            block.y = 350 - block.h;
            block.vy *= -0.16;
            block.vx *= 0.75;
            if (Math.abs(block.vy) < 1) block.vy = 0;
          }

          for (const other of next.blocks) {
            if (other.id === block.id || other.hp <= 0) continue;

            const overlap =
              block.x < other.x + other.w &&
              block.x + block.w > other.x &&
              block.y < other.y + other.h &&
              block.y + block.h > other.y;

            if (overlap) {
              other.falling = true;
              other.vx += block.vx * 0.3;
              other.vy += Math.max(0, block.vy * 0.25);
              block.vy *= -0.12;
              block.hp -= 0.015;
              other.hp -= 0.01;
            }
          }

          // Falling debris can crush targets below it.
          for (const pig of next.pigs) {
            if (!pig.alive) continue;

            const close =
              pig.x > block.x - 12 &&
              pig.x < block.x + block.w + 12 &&
              pig.y + 13 > block.y &&
              pig.y - 13 < block.y + block.h;

            if (close) {
              pig.alive = false;
              scoreRef.current += 650;
              addParticles(next.particles, pig.x, pig.y, "#7fe18b");
              setMessage("CRUSHED! The falling building took out a target!");
            }
          }

          if (block.hp <= 0) {
            addParticles(next.particles, block.x, block.y, "#c58a50");
          }
        }
      }

      next.blocks = next.blocks.filter((b) => b.hp > 0);
      next.particles = next.particles
        .map((p) => ({ ...p, life: p.life - 0.035, y: p.y - 0.7 }))
        .filter((p) => p.life > 0);

      if (power !== "multi") {
        x = birds[0].x;
        y = birds[0].y;
        vx = birds[0].vx;
        vy = birds[0].vy;
        setProjectile({ x, y });
      } else {
        tripleBirds = birds;
        setProjectile({ x: birds[0].x, y: birds[0].y });
      }

      updateWorld(next);
      setScore(scoreRef.current);
      checkWin(next);

      const allGone = birds.every(
        (bird) => bird.x > 850 || bird.y > 470 || bird.y < -80
      );

      if (allGone) {
        stopPhysics();
        setLaunched(false);
        setProjectile({ x: 150, y: 310 });
        projectileRef.current = { x: 150, y: 310 };
        if (!wonRef.current) {
          setMessage("The birds have finished flying. Take another shot!");
        }
      }
    }, 16);
  };

  const buyPowerup = (id: Powerup) => {
    const item = powerupInfo.find((p) => p.id === id);
    if (!item || coins < item.price) return;

    setCoins((v) => v - item.price);
    setPowerups((v) => ({ ...v, [id]: v[id] + 1 }));
  };

  const buySkin = (skin: (typeof skins)[number]) => {
    if (unlockedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      return;
    }
    if (coins < skin.price) return;

    setCoins((v) => v - skin.price);
    setUnlockedSkins((v) => [...v, skin.id]);
    setSelectedSkin(skin.id);
  };

  const nextLevel = () => {
    if (activeLevel < levelCount) startLevel(activeLevel + 1);
    else setScreen("levels");
  };

  if (!loaded) {
    return (
      <main className="loading">
        <div>🐦</div>
        <h1>Slingshot Adventures</h1>
        <p>Loading your game...</p>
        <style jsx>{`
          .loading{min-height:100vh;display:grid;place-content:center;text-align:center;background:#101522;color:white;font-family:Arial}
          .loading div{font-size:55px}.loading p{color:#9ca8bb}
        `}</style>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <Link href="/" className="brand"><span>🎮</span> Keith&apos;s Games</Link>
        <div className="nav-label">SLINGSHOT ADVENTURES</div>
        <button className={screen === "home" ? "nav active" : "nav"} onClick={() => setScreen("home")}>⌂ <span>Dashboard</span></button>
        <button className={screen === "levels" ? "nav active" : "nav"} onClick={() => setScreen("levels")}>▦ <span>Levels</span></button>
        <button className={screen === "shop" ? "nav active" : "nav"} onClick={() => setScreen("shop")}>🛍️ <span>Shop</span></button>
        <div className="player"><div>K</div><span><b>Keith</b><small>Player</small></span></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div><small>YOUR ARCADE</small><h1>Slingshot Adventures</h1></div>
          <div className="top-right"><span className="coins">🪙 {coins.toLocaleString()}</span><small className="saved">{saving ? "Saving..." : "● Saved"}</small></div>
        </header>

        {screen === "home" && (
          <div className="content">
            <section className="hero">
              <div><span className="tag">🐦 THE ADVENTURE STARTS HERE</span><h2>Knock it all down.</h2><p>Build your aim, smash the structures and defeat every target.</p><button className="primary" onClick={() => startLevel(unlockedLevels)}>Play level {unlockedLevels} →</button></div>
              <div className="hero-art">🏚️💥</div>
            </section>
            <div className="section-title"><div><small>YOUR PROGRESS</small><h2>Adventure overview</h2></div></div>
            <div className="stats">
              <div><span>🏆</span><b>{completedLevels.length}/{levelCount}</b><small>Levels completed</small></div>
              <div><span>🪙</span><b>{coins.toLocaleString()}</b><small>Coins collected</small></div>
              <div><span>💪</span><b>{Object.values(powerups).reduce((a, b) => a + b, 0)}</b><small>Power-ups available</small></div>
            </div>
            <div className="section-title"><div><small>KEEP PLAYING</small><h2>Your adventure</h2></div><button className="link-button" onClick={() => setScreen("levels")}>All levels →</button></div>
            <div className="quick">
              {[1, 2, 3].map((n) => <button key={n} disabled={n > unlockedLevels} onClick={() => startLevel(n)}><span>{completedLevels.includes(n) ? "🏆" : "🎯"}</span><b>Level {n}</b><small>{completedLevels.includes(n) ? "Completed" : n > unlockedLevels ? "Locked" : "Ready to play"}</small>→</button>)}
            </div>
            <section className="promo"><span>💥</span><div><b>Need a little extra power?</b><small>Stock up on heavy birds, explosions and triple shots.</small></div><button className="secondary" onClick={() => setScreen("shop")}>Visit shop →</button></section>
          </div>
        )}

        {screen === "levels" && (
          <div className="content">
            <div className="section-title"><div><small>YOUR JOURNEY</small><h2>Choose a level</h2><p>Each level adds more structures and tougher layouts.</p></div></div>
            <div className="level-grid">
              {Array.from({ length: levelCount }, (_, i) => i + 1).map((n) => (
                <button key={n} disabled={n > unlockedLevels} className={completedLevels.includes(n) ? "level-card done" : "level-card"} onClick={() => startLevel(n)}>
                  <span>{n > unlockedLevels ? "🔒" : completedLevels.includes(n) ? "🏆" : "🎯"}</span><b>Level {n}</b><small>{n > unlockedLevels ? "Locked" : completedLevels.includes(n) ? "Completed" : "Available"}</small>{bestScores[n] ? <small>{bestScores[n]} pts</small> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "shop" && (
          <div className="content">
            <div className="shop-head"><div><small>THE COLLECTION</small><h2>Adventure shop</h2><p>Use coins earned from levels to upgrade your game.</p></div><span className="coins">🪙 {coins.toLocaleString()}</span></div>
            <div className="tabs"><button className={shopTab === "powerups" ? "tab active-tab" : "tab"} onClick={() => setShopTab("powerups")}>💥 Power-ups</button><button className={shopTab === "birds" ? "tab active-tab" : "tab"} onClick={() => setShopTab("birds")}>🐦 Bird styles</button></div>
            {shopTab === "powerups" ? (
              <div className="shop-grid">
                {powerupInfo.map((p) => <article className="shop-card" key={p.id}><div className="shop-icon">{p.emoji}</div><h3>{p.name}</h3><p>{p.description}</p><small>You own: {powerups[p.id]}</small><button className="primary full" disabled={coins < p.price} onClick={() => buyPowerup(p.id)}>Buy · 🪙 {p.price}</button></article>)}
              </div>
            ) : (
              <div className="shop-grid">
                {skins.map((s) => {
                  const owned = unlockedSkins.includes(s.id);
                  return <article className="shop-card" key={s.id}><div className="shop-icon" style={{ color: s.colour }}>{s.emoji}</div><h3>{s.name}</h3><p>A different look for your bird.</p><button className="primary full" disabled={!owned && coins < s.price} onClick={() => buySkin(s)}>{selectedSkin === s.id ? "✓ Equipped" : owned ? "Equip" : `Buy · 🪙 ${s.price}`}</button></article>;
                })}
              </div>
            )}
          </div>
        )}

        {screen === "game" && (
          <div className="content play-content">
            <div className="play-head"><div><small>SLINGSHOT CHALLENGE</small><h2>Level {activeLevel}</h2></div><div className="play-stat"><span>🎯 {shots} shots</span><span>⭐ {score.toLocaleString()}</span><span>🐷 {world.pigs.filter(p => p.alive).length} left</span></div></div>

            <div className={shake ? "board shake" : "board"}>
              <svg ref={svgRef} viewBox="0 0 800 450" className="game-svg" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={launch} onPointerCancel={launch}>
                <defs>
                  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#78c5ef"/><stop offset="1" stopColor="#e6f6ff"/></linearGradient>
                  <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#83c96b"/><stop offset="1" stopColor="#3e914d"/></linearGradient>
                  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9a66e"/><stop offset="1" stopColor="#94603b"/></linearGradient>
                  <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8c2ce"/><stop offset="1" stopColor="#697787"/></linearGradient>
                </defs>
                <rect width="800" height="450" fill="url(#sky)"/>
                <circle cx="680" cy="70" r="34" fill="#ffe7a1"/>
                <g fill="#fff" opacity=".7"><ellipse cx="160" cy="90" rx="45" ry="13"/><ellipse cx="190" cy="84" rx="29" ry="17"/><ellipse cx="450" cy="125" rx="35" ry="10"/></g>
                <path d="M0 330 Q120 270 260 330 T520 315 T800 325 V450 H0Z" fill="#9dcf83"/>
                <rect y="350" width="800" height="100" fill="url(#grass)"/>
                <path d="M0 370 Q180 350 350 375 T800 360" stroke="#b5e38a" strokeWidth="5" fill="none"/>
                <g opacity=".7" fill="#438a4e"><path d="M30 350 l12 -35 12 35 M60 350 l10 -25 10 25 M740 350 l13 -38 13 38"/></g>

                {/* Launcher: wooden fork, rope and sling */}
                <path d="M112 390 L145 300 L160 305 L145 390Z" fill="#79502f" stroke="#53371f" strokeWidth="3"/>
                <path d="M145 310 L128 270 M145 310 L174 270" stroke="#79502f" strokeWidth="13" strokeLinecap="round"/>
                <path d="M128 270 Q146 250 174 270" stroke="#4e3525" strokeWidth="5" fill="none"/>
                {dragging && <path d={`M128 270 Q145 290 ${projectile.x} ${projectile.y}`} stroke="#4d3827" strokeWidth="5" fill="none"/>}
                {!dragging && <path d="M128 270 Q145 290 150 310" stroke="#4d3827" strokeWidth="4" fill="none"/>}

                {/* Building blocks */}
                {world.blocks.map((b) => {
                  const fill = b.material === "wood" ? "url(#wood)" : b.material === "stone" ? "url(#stone)" : "#a8e8f2";
                  return (
                    <g key={b.id} transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2}) rotate(${b.angle * 180 / Math.PI})`} opacity={b.hp <= 0 ? 0 : 1}>
                      <rect x={-b.w / 2} y={-b.h / 2} width={b.w} height={b.h} rx="3" fill={fill} stroke={b.material === "glass" ? "#4cacc2" : "#64482f"} strokeWidth="2"/>
                      {b.material === "wood" && <path d={`M${-b.w/2+5} 0 H${b.w/2-5}`} stroke="#87552f" strokeWidth="2" opacity=".55"/>}
                      {b.material === "stone" && <path d={`M${-b.w/2+5} ${-b.h/2+5} H${b.w/2-5}`} stroke="#e0e6eb" strokeWidth="2" opacity=".5"/>}
                      {b.material === "glass" && <path d={`M${-b.w/2+4} ${b.h/2-4} L${b.w/2-4} ${-b.h/2+4}`} stroke="#fff" strokeWidth="3" opacity=".75"/>}
                      {b.hp < 2 && <path d={`M-4 ${-b.h/2+3} l-4 7 7 4 -5 8`} stroke="#4d3528" strokeWidth="2" fill="none"/>}
                    </g>
                  );
                })}

                {/* Targets */}
                {world.pigs.filter(p => p.alive).map((pig) => (
                  <g key={pig.id}>
                    <ellipse cx={pig.x} cy={pig.y + 13} rx="17" ry="5" fill="#315c38" opacity=".25"/>
                    <circle cx={pig.x} cy={pig.y} r="14" fill="#72d56c" stroke="#398a48" strokeWidth="2"/>
                    <circle cx={pig.x - 5} cy={pig.y - 3} r="2.4" fill="#172b21"/>
                    <circle cx={pig.x + 5} cy={pig.y - 3} r="2.4" fill="#172b21"/>
                    <ellipse cx={pig.x} cy={pig.y + 5} rx="6" ry="4" fill="#b8ed9e"/>
                    <circle cx={pig.x - 2} cy={pig.y + 5} r="1" fill="#386f42"/>
                    <circle cx={pig.x + 2} cy={pig.y + 5} r="1" fill="#386f42"/>
                    <path d={`M${pig.x-9} ${pig.y-11} l-4 -9 10 4 M${pig.x+9} ${pig.y-11} l4 -9 -10 4`} fill="#72d56c" stroke="#398a48" strokeWidth="2"/>
                  </g>
                ))}

                {/* Flying bird */}
                {!levelWon && <g>
                  <circle cx={projectile.x} cy={projectile.y} r={selectedPowerup === "heavy" ? 18 : 13} fill={currentSkin.colour} stroke="#fff" strokeWidth="2.5"/>
                  <path d={`M${projectile.x-7} ${projectile.y-8} q-12 -12 -12 -2 q8 0 12 2`} fill="#fff" opacity=".7"/>
                  <circle cx={projectile.x+4} cy={projectile.y-3} r="3" fill="#fff"/>
                  <circle cx={projectile.x+5} cy={projectile.y-3} r="1.5" fill="#18202b"/>
                  <path d={`M${projectile.x+10} ${projectile.y+1} l10 4 -10 4`} fill="#f4bd50"/>
                </g>}

                {/* Debris and impact particles */}
                {world.particles.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 + p.life * 3} fill={p.colour} opacity={p.life}/>)}
                {dragging && <path d={`M${projectile.x} ${projectile.y} L${projectile.x+(150-projectile.x)*2} ${projectile.y+(310-projectile.y)*2}`} stroke="#34495e" strokeWidth="2" strokeDasharray="6 7" opacity=".6"/>}
              </svg>
              <div className="game-message">{message}</div>
            </div>

            <div className="powerup-bar">
              <div className="powerup-heading"><b>IN-GAME POWER-UPS</b><small>Select one before launching</small></div>
              {powerupInfo.map((p) => (
                <button key={p.id} disabled={powerups[p.id] <= 0 || launched || levelWon} className={selectedPowerup === p.id ? "power-button chosen" : "power-button"} onClick={() => setSelectedPowerup(selectedPowerup === p.id ? null : p.id)}>
                  <span>{p.emoji}</span><b>{p.name}</b><small>×{powerups[p.id]}</small>
                </button>
              ))}
            </div>

            <div className="game-controls">
              <button className="secondary" onClick={resetShot}>↻ Reset bird</button>
              <button className="secondary" onClick={() => setScreen("levels")}>Exit level</button>
              <small>Pull the bird backwards, aim at the structure and release.</small>
            </div>

            {levelWon && <div className="win-panel"><div>🏆</div><h2>All targets defeated!</h2><p>You scored {score.toLocaleString()} points.</p><p className="win-coins">🪙 Coins added to your balance</p><button className="primary" onClick={nextLevel}>{activeLevel === levelCount ? "Finish" : "Next level →"}</button><button className="secondary" onClick={() => setScreen("levels")}>Level selection</button></div>}
          </div>
        )}

        <footer>Keith&apos;s Games <span>Slingshot Adventures</span></footer>
      </section>

      <style jsx>{`
        *{box-sizing:border-box}
        .app{min-height:100vh;display:flex;background:#101522;color:#f4f6fb;font-family:Arial,Helvetica,sans-serif}
        button{font:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}
        .sidebar{width:235px;flex-shrink:0;background:#171e2c;border-right:1px solid #2b3445;padding:25px 17px;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh}
        .brand{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none;font-weight:800;font-size:16px;margin:0 5px 52px}.brand span{width:38px;height:38px;display:grid;place-items:center;background:#7055d8;border-radius:12px;font-size:20px}
        .nav-label,.topbar small,.section-title small,.shop-head small,.play-head small{font-size:10px;letter-spacing:1.4px;font-weight:800;color:#8491a7}
        .nav-label{margin:0 8px 14px}.nav{width:100%;padding:13px 12px;display:flex;gap:13px;align-items:center;background:transparent;border:0;border-radius:9px;color:#aeb9ca;text-align:left;margin-bottom:5px}.nav span{font-size:13px}.nav.active,.nav:hover{background:#2b2b45;color:white;box-shadow:inset 3px 0 #a58bff}
        .player{margin-top:auto;border-top:1px solid #303a4b;padding:20px 5px 0;display:flex;align-items:center;gap:11px}.player div{width:37px;height:37px;border-radius:50%;background:#4c9b83;display:grid;place-items:center;font-weight:800}.player b,.player small{display:block}.player b{font-size:13px}.player small{font-size:10px;color:#8d9ab0;margin-top:4px}
        .main{flex:1;min-width:0;padding:27px 36px 20px}.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:27px;gap:15px}.topbar h1{font-size:23px;margin:6px 0 0}.top-right{display:flex;align-items:center;gap:15px}.coins{background:#30291a;border:1px solid #66532b;color:#f4d278;border-radius:10px;padding:10px 14px;font-weight:800;font-size:13px}.saved{font-size:10px;color:#79c99b}
        .content{max-width:1150px}.hero{min-height:220px;padding:32px 37px;border-radius:18px;background:linear-gradient(110deg,#352c65,#62458e 60%,#9c6590);display:flex;align-items:center;justify-content:space-between;overflow:hidden}.tag{font-size:10px;letter-spacing:1px;font-weight:800;color:#ded4ff}.hero h2{font-size:clamp(28px,4vw,40px);letter-spacing:-1px;margin:14px 0 9px}.hero p{font-size:13px;color:#ded8ee;margin-bottom:20px}.hero-art{font-size:80px;margin-right:30px;filter:drop-shadow(0 12px 10px #211b3b66)}
        .primary,.secondary{border:0;border-radius:9px;padding:12px 17px;font-size:12px;font-weight:800}.primary{background:#f0cb70;color:#2b2111}.secondary{background:#303a4d;color:#f1f4f8}.primary:hover,.secondary:hover{filter:brightness(1.1);transform:translateY(-1px)}.full{width:100%}
        .section-title{display:flex;align-items:center;justify-content:space-between;margin:30px 0 16px}.section-title h2,.shop-head h2,.play-head h2{font-size:20px;margin:6px 0 0}.section-title p,.shop-head p{font-size:12px;color:#929eb2;margin:7px 0 0}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.stats>div{padding:17px;background:#1a2231;border:1px solid #30394b;border-radius:12px}.stats span,.stats b,.stats small{display:block}.stats span{font-size:21px;margin-bottom:10px}.stats b{font-size:24px}.stats small{font-size:11px;color:#9aa6b9;margin-top:5px}.link-button{background:none;border:0;color:#b7a5ff;font-size:12px;font-weight:800}
        .quick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.quick button{display:grid;grid-template-columns:35px 1fr 15px;align-items:center;text-align:left;gap:4px 10px;padding:14px;background:#1a2231;border:1px solid #30394b;border-radius:11px;color:white}.quick button span{grid-row:span 2;font-size:22px}.quick button b{font-size:12px}.quick button small{font-size:10px;color:#929db0}.quick button> :last-child{grid-column:3;grid-row:1/3;color:#b6a5ff}.promo{display:flex;align-items:center;gap:14px;margin-top:22px;padding:17px;background:#20283a;border:1px solid #343e52;border-radius:12px}.promo>span{font-size:27px}.promo div{display:grid;gap:5px}.promo b{font-size:13px}.promo small{font-size:11px;color:#a0acc0}.promo button{margin-left:auto;white-space:nowrap}
        .level-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:13px}.level-card{min-height:135px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:#1b2332;border:1px solid #354054;border-radius:12px;color:white}.level-card span{font-size:26px}.level-card b{font-size:13px}.level-card small{font-size:10px;color:#9ba8bb}.level-card.done{border-color:#5d9876;background:#1d302c}
        .shop-head,.play-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.tabs{display:flex;gap:8px;margin:24px 0 17px}.tab{border:1px solid #384258;background:#1c2535;color:#aeb9c9;border-radius:9px;padding:11px 15px;font-size:12px;font-weight:800}.active-tab{background:#42376b;color:#fff;border-color:#7761bd}.shop-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.shop-card{padding:17px;background:#1b2332;border:1px solid #354054;border-radius:13px}.shop-icon{height:95px;display:grid;place-items:center;background:#252e40;border-radius:10px;font-size:42px}.shop-card h3{font-size:15px;margin:14px 0 7px}.shop-card p{font-size:11px;color:#9ba8bb;min-height:30px;line-height:1.5}.shop-card>small{display:block;color:#e0c875;font-size:10px;margin:10px 0}
        .play-content{max-width:1100px}.play-stat{display:flex;gap:8px;flex-wrap:wrap}.play-stat span{padding:10px 12px;background:#202a3b;border-radius:8px;font-size:11px;color:#dce2ec}.board{position:relative;margin-top:20px;border-radius:14px;overflow:hidden;border:1px solid #44536b;background:#9bd8f5;box-shadow:0 15px 35px #0003}.game-svg{display:block;width:100%;touch-action:none;cursor:crosshair}.game-message{position:absolute;bottom:0;left:0;right:0;padding:11px 14px;text-align:center;background:#151d2be8;color:#fff;font-size:12px}.shake{animation:shake .22s linear}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
        .powerup-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:17px;padding:14px;background:#1b2434;border:1px solid #354055;border-radius:12px}.powerup-heading{display:grid;gap:5px;margin-right:auto}.powerup-heading b{font-size:11px;letter-spacing:.8px}.powerup-heading small{font-size:10px;color:#929fb4}.power-button{display:grid;grid-template-columns:25px auto auto;align-items:center;gap:6px;background:#283349;color:#f3f5fa;border:1px solid #3d4b64;border-radius:9px;padding:9px 11px}.power-button span{font-size:18px}.power-button b{font-size:10px}.power-button small{font-size:10px;color:#f1d17c}.power-button.chosen{border-color:#b19aff;background:#453a70;box-shadow:0 0 0 2px #9276df55}.game-controls{display:flex;align-items:center;gap:9px;margin-top:13px;flex-wrap:wrap}.game-controls small{margin-left:auto;color:#929fb2;font-size:11px}.win-panel{margin-top:20px;text-align:center;padding:24px;background:#1c2d29;border:1px solid #5c9a78;border-radius:14px}.win-panel>div{font-size:36px}.win-panel h2{font-size:22px;margin:8px 0}.win-panel p{color:#aebeb4;font-size:12px}.win-panel .win-coins{color:#f2d178}.win-panel button{margin:5px}
        footer{margin-top:35px;padding-top:17px;border-top:1px solid #293346;color:#78869c;font-size:10px}footer span{float:right}
        @media(max-width:900px){.sidebar{width:190px}.main{padding:22px}.level-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:650px){.app{display:block}.sidebar{position:static;width:100%;height:auto;min-height:0;padding:12px;flex-direction:row;align-items:center;gap:8px;overflow-x:auto}.brand{margin:0 10px 0 0;white-space:nowrap;font-size:13px}.brand span{width:32px;height:32px}.nav-label,.player{display:none}.nav{width:auto;white-space:nowrap;padding:10px;font-size:12px}.nav span{display:none}.main{padding:17px 13px}.topbar h1{font-size:18px}.top-right{gap:7px}.saved{display:none}.hero{padding:23px;min-height:190px}.hero-art{font-size:43px;margin:0}.hero h2{font-size:27px}.stats{gap:8px}.stats>div{padding:12px}.stats b{font-size:19px}.quick{grid-template-columns:1fr}.level-grid{grid-template-columns:repeat(2,1fr)}.shop-grid{grid-template-columns:1fr 1fr}.shop-head{align-items:flex-start}.play-head{align-items:flex-start;flex-direction:column}.play-stat{gap:5px}.powerup-heading{width:100%}.power-button{flex:1}.game-controls small{width:100%;margin:4px 0}.promo{flex-wrap:wrap}.promo button{margin-left:0}.game-message{font-size:10px;padding:8px}}
        @media(max-width:390px){.shop-grid{grid-template-columns:1fr}.power-button{padding:8px 6px}.power-button b{font-size:9px}}
      `}</style>
    </main>
  );
}
