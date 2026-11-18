"use client";


import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { loadGameSave, saveGame } from "@/lib/game-saves";

type Material = "wood" | "glass" | "stone";
type Body = {
  id: number;
  kind: "block" | "pig" | "bird";
  material?: Material;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  angle: number;
  radius?: number;
};

type SavedData = {
  unlockedLevels?: number;
  completedLevels?: number[];
  unlockedSkins?: string[];
  selectedSkin?: string;
  bestScores?: Record<number, number>;
};

const W = 960;
const H = 540;
const GROUND = 465;
const SLING = { x: 155, y: 360 };
const MAX_PULL = 115;

const skins = [
  { id: "classic", name: "Classic", emoji: "🐦", price: 0, colour: "#bd4938" },
  { id: "gold", name: "Golden", emoji: "🌟", price: 150, colour: "#f5c542" },
  { id: "ice", name: "Frost", emoji: "❄️", price: 250, colour: "#62c9ed" },
  { id: "fire", name: "Inferno", emoji: "🔥", price: 350, colour: "#ff714d" },
  { id: "neon", name: "Neon", emoji: "💜", price: 500, colour: "#b58aff" },
  { id: "nature", name: "Nature", emoji: "🌿", price: 650, colour: "#63c985" },
];

const materialStats: Record<Material, { hp: number; colour: string }> = {
  wood: { hp: 3, colour: "#b77942" },
  glass: { hp: 1, colour: "#7ed8e9" },
  stone: { hp: 7, colour: "#858b98" },
};

let nextId = 1;

function block(
  material: Material,
  x: number,
  y: number,
  w: number,
  h: number
): Body {
  return {
    id: nextId++,
    kind: "block",
    material,
    x,
    y,
    w,
    h,
    vx: 0,
    vy: 0,
    hp: materialStats[material].hp,
    alive: true,
    angle: 0,
  };
}

function pig(x: number, y: number): Body {
  return {
    id: nextId++,
    kind: "pig",
    x,
    y,
    w: 34,
    h: 34,
    radius: 17,
    vx: 0,
    vy: 0,
    hp: 2,
    alive: true,
    angle: 0,
  };
}

function makeLevel(level: number): Body[] {
  nextId = 1;
  const bodies: Body[] = [];

  const base = 620 + (level - 1) * 12;
  const width = 180 + Math.min(level * 8, 90);
  const towerHeight = 90 + Math.min(level * 12, 130);

  // Main wooden fortress.
  bodies.push(block("wood", base, GROUND - 15, width, 18));
  bodies.push(block("wood", base + 8, GROUND - towerHeight, 18, towerHeight - 15));
  bodies.push(block("wood", base + width - 26, GROUND - towerHeight, 18, towerHeight - 15));
  bodies.push(block("wood", base, GROUND - towerHeight - 15, width, 18));

  // Upper tower.
  bodies.push(block("glass", base + 28, GROUND - towerHeight - 55, 18, 40));
  bodies.push(block("glass", base + width - 46, GROUND - towerHeight - 55, 18, 40));
  bodies.push(block("wood", base + 20, GROUND - towerHeight - 68, width - 40, 15));

  // Stone protection increases on later levels.
  if (level >= 3) {
    bodies.push(block("stone", base + 45, GROUND - 48, 48, 32));
  }

  if (level >= 5) {
    bodies.push(block("stone", base + width - 90, GROUND - towerHeight - 105, 55, 25));
  }

  if (level >= 7) {
    bodies.push(block("wood", base + 35, GROUND - towerHeight - 125, 18, 55));
    bodies.push(block("wood", base + width - 53, GROUND - towerHeight - 125, 18, 55));
    bodies.push(block("glass", base + 35, GROUND - towerHeight - 140, width - 70, 15));
  }

  const pigCount = Math.min(1 + Math.floor((level - 1) / 2), 5);

  for (let i = 0; i < pigCount; i++) {
    const px = base + 35 + (i % 3) * 48;
    const py = GROUND - 35 - (i >= 3 ? 70 : 0);
    bodies.push(pig(px, py));
  }

  // Extra obstacle wall on higher levels.
  if (level >= 2) {
    bodies.push(block("wood", 420, GROUND - 95, 20, 95));
    bodies.push(block("wood", 480, GROUND - 95, 20, 95));
    bodies.push(block("glass", 420, GROUND - 110, 80, 15));
  }

  if (level >= 4) {
    bodies.push(block("stone", 520, GROUND - 45, 35, 35));
  }

  return bodies;
}

export default function SlingshotPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<Body[]>([]);
  const animationRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const launchedRef = useRef(false);
  const pullRef = useRef({ x: SLING.x, y: SLING.y });
  const birdRef = useRef<Body | null>(null);
  const birdQueueRef = useRef(3);
  const abilityUsedRef = useRef(false);
  const abilityRef = useRef(false);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const completedRef = useRef(false);
  const lastTimeRef = useRef(0);

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
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [birdsLeft, setBirdsLeft] = useState(3);
  const [message, setMessage] = useState("Pull the bird backwards to aim.");
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [ability, setAbility] = useState("Ready");
  const [showTrajectory, setShowTrajectory] = useState(true);

  const skin = skins.find((s) => s.id === selectedSkin) ?? skins[0];

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
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
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
        console.error(error);
        setNotice("Could not load your saved game or coin balance.");
      } finally {
        if (active) setLoaded(true);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [refreshCoins]);

  useEffect(() => {
    if (!loaded) return;

    const timeout = setTimeout(() => {
      void saveProgress({
        unlockedLevels,
        completedLevels,
        unlockedSkins,
        selectedSkin,
        bestScores,
      });
    }, 600);

    return () => clearTimeout(timeout);
  }, [
    loaded,
    unlockedLevels,
    completedLevels,
    unlockedSkins,
    selectedSkin,
    bestScores,
    saveProgress,
  ]);

  const createBird = useCallback(() => {
    const bird: Body = {
      id: nextId++,
      kind: "bird",
      x: SLING.x,
      y: SLING.y,
      w: 34,
      h: 34,
      radius: 17,
      vx: 0,
      vy: 0,
      hp: 1,
      alive: true,
      angle: 0,
    };

    birdRef.current = bird;
    pullRef.current = { ...SLING };
    launchedRef.current = false;
    draggingRef.current = false;
    abilityUsedRef.current = false;
    abilityRef.current = false;
    setAbility("Ready");
  }, []);

  const startLevel = useCallback((level: number) => {
    if (level < 1 || level > unlockedLevels) return;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    levelRef.current = level;
    worldRef.current = makeLevel(level);
    birdQueueRef.current = 3 + Math.floor((level - 1) / 3);
    scoreRef.current = 0;
    completedRef.current = false;

    setActiveLevel(level);
    setScore(0);
    setShots(0);
    setBirdsLeft(birdQueueRef.current);
    setWon(false);
    setLost(false);
    setMessage("Pull the bird backwards to aim.");
    setScreen("game");
    createBird();
  }, [unlockedLevels, createBird]);

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const startDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!birdRef.current || launchedRef.current || won || lost) return;

    const p = pointerPosition(event);
    const bird = birdRef.current;

    if (Math.hypot(p.x - bird.x, p.y - bird.y) < 55) {
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      setMessage("Aim carefully. The dotted line shows the predicted flight.");
    }
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;

    const p = pointerPosition(event);
    const dx = p.x - SLING.x;
    const dy = p.y - SLING.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > MAX_PULL ? MAX_PULL / distance : 1;

    pullRef.current = {
      x: SLING.x + dx * scale,
      y: SLING.y + dy * scale,
    };

    if (pullRef.current.x > SLING.x + 10) {
      pullRef.current.x = SLING.x + 10;
    }

    if (birdRef.current) {
      birdRef.current.x = pullRef.current.x;
      birdRef.current.y = pullRef.current.y;
    }
  };

  const awardLevel = async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    setWon(true);
    setMessage("Fortress destroyed!");

    const finalScore = scoreRef.current;
    setScore(finalScore);

    setCompletedLevels((previous) =>
      previous.includes(levelRef.current)
        ? previous
        : [...previous, levelRef.current]
    );

    setUnlockedLevels((previous) =>
      Math.max(previous, Math.min(10, levelRef.current + 1))
    );

    setBestScores((previous) => ({
      ...previous,
      [levelRef.current]: Math.max(
        previous[levelRef.current] ?? 0,
        finalScore
      ),
    }));

    try {
      const { data, error } = await supabase.rpc(
        "complete_slingshot_level",
        { target_level: levelRef.current }
      );

      if (error) throw error;

      const earned = Number(data ?? 0);
      setNotice(
        earned > 0
          ? `Level completed. ${earned} coins awarded!`
          : "Level completed. This level's coin reward was already collected."
      );

      await refreshCoins();
    } catch (error) {
      console.error(error);
      setNotice("Level completed, but the coin reward could not be saved.");
    }
  };

  const releaseBird = () => {
    if (!draggingRef.current || !birdRef.current) return;

    draggingRef.current = false;

    const bird = birdRef.current;
    const dx = SLING.x - bird.x;
    const dy = SLING.y - bird.y;

    if (Math.hypot(dx, dy) < 10) {
      bird.x = SLING.x;
      bird.y = SLING.y;
      return;
    }

    bird.vx = dx * 0.17;
    bird.vy = dy * 0.17;
    launchedRef.current = true;

    setShots((n) => n + 1);
    birdQueueRef.current -= 1;
    setBirdsLeft(birdQueueRef.current);
    setMessage("Bird launched! Tap the ability button for its special move.");
  };

  const activateAbility = () => {
    const bird = birdRef.current;

    if (!bird || !launchedRef.current || abilityUsedRef.current) return;

    abilityUsedRef.current = true;
    abilityRef.current = true;

    // Each skin currently has a distinct simple special effect.
    if (selectedSkin === "ice") {
      bird.vx *= 1.8;
      bird.vy *= 1.8;
      setAbility("Ice boost used");
    } else if (selectedSkin === "fire") {
      const targets = worldRef.current.filter(
        (b) => b.alive && b.kind !== "bird" &&
          Math.hypot(b.x - bird.x, b.y - bird.y) < 125
      );

      targets.forEach((target) => {
        target.hp -= 3;
        target.vx += (target.x - bird.x) * 0.07;
        target.vy -= 5;
      });

      setAbility("Fire burst used");
    } else if (selectedSkin === "gold") {
      bird.vx *= 1.5;
      bird.vy *= 1.5;
      setAbility("Golden dash used");
    } else if (selectedSkin === "nature") {
      bird.vy -= 8;
      setAbility("Nature jump used");
    } else {
      bird.vx *= 1.3;
      bird.vy *= 1.3;
      setAbility("Speed boost used");
    }

    setMessage("Special ability activated!");
  };

  const buySkin = async (item: (typeof skins)[number]) => {
    if (busy) return;

    if (unlockedSkins.includes(item.id)) {
      setSelectedSkin(item.id);
      return;
    }

    if (!userId) {
      setNotice("Sign in to purchase skins.");
      return;
    }

    if (coins < item.price) {
      setNotice("You do not have enough coins.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.rpc(
        "spend_slingshot_coins",
        { coin_amount: item.price }
      );

      if (error) throw error;

      setCoins(Number(data));
      setUnlockedSkins((old) => [...old, item.id]);
      setSelectedSkin(item.id);
      setNotice(`${item.name} unlocked.`);
    } catch (error) {
      console.error(error);
      setNotice("Purchase failed.");
      await refreshCoins();
    } finally {
      setBusy(false);
    }
  };

  // Main canvas engine: gravity, collisions, damage, debris and aiming scope.
  useEffect(() => {
    if (screen !== "game") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let running = true;

    const roundedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    const drawBird = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.fillStyle = skin.colour;
      ctx.strokeStyle = "#542d27";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tail feathers.
      ctx.fillStyle = "#8c332b";
      ctx.beginPath();
      ctx.moveTo(-14, 3);
      ctx.lineTo(-29, -8);
      ctx.lineTo(-24, 5);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      ctx.fill();

      // White belly.
      ctx.fillStyle = "#f7e8d2";
      ctx.beginPath();
      ctx.ellipse(4, 9, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes and pupils.
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(5, -6, 7, 0, Math.PI * 2);
      ctx.arc(15, -5, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1c1c25";
      ctx.beginPath();
      ctx.arc(7, -6, 2.8, 0, Math.PI * 2);
      ctx.arc(16, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Beak.
      ctx.fillStyle = "#f3b53e";
      ctx.beginPath();
      ctx.moveTo(15, 1);
      ctx.lineTo(29, 5);
      ctx.lineTo(15, 10);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawPig = (x: number, y: number, radius: number) => {
      ctx.save();
      ctx.translate(x, y);

      ctx.fillStyle = "#65bd4b";
      ctx.strokeStyle = "#347a37";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ears.
      ctx.fillStyle = "#65bd4b";
      ctx.beginPath();
      ctx.arc(-11, -14, 7, 0, Math.PI * 2);
      ctx.arc(11, -14, 7, 0, Math.PI * 2);
      ctx.fill();

      // Snout.
      ctx.fillStyle = "#a1dc79";
      ctx.beginPath();
      ctx.ellipse(0, 6, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#36713a";
      ctx.beginPath();
      ctx.arc(-4, 6, 2, 0, Math.PI * 2);
      ctx.arc(4, 6, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(-7, -6, 5, 0, Math.PI * 2);
      ctx.arc(7, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1d2920";
      ctx.beginPath();
      ctx.arc(-6, -6, 2, 0, Math.PI * 2);
      ctx.arc(8, -6, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawBlock = (body: Body) => {
      ctx.save();
      ctx.translate(body.x + body.w / 2, body.y + body.h / 2);
      ctx.rotate(body.angle);

      const material = body.material ?? "wood";
      const colour = materialStats[material].colour;

      ctx.fillStyle = colour;
      ctx.strokeStyle =
        material === "wood" ? "#704325" :
        material === "glass" ? "#378fa8" : "#555b67";
      ctx.lineWidth = 3;

      roundedRect(-body.w / 2, -body.h / 2, body.w, body.h, 4);
      ctx.fill();
      ctx.stroke();

      if (material === "wood") {
        ctx.strokeStyle = "#e2b27b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-body.w / 2 + 5, -body.h / 2 + 5);
        ctx.lineTo(body.w / 2 - 5, body.h / 2 - 5);
        ctx.stroke();

        ctx.strokeStyle = "#8d542f";
        ctx.beginPath();
        ctx.moveTo(-body.w / 2 + 5, body.h / 2 - 5);
        ctx.lineTo(body.w / 2 - 5, -body.h / 2 + 5);
        ctx.stroke();
      }

      if (material === "glass") {
        ctx.strokeStyle = "#e4fbff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-body.w / 2 + 5, -body.h / 2 + 5);
        ctx.lineTo(body.w / 2 - 5, body.h / 2 - 5);
        ctx.stroke();
      }

      if (material === "stone") {
        ctx.strokeStyle = "#aeb4c0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-body.w / 2 + 5, 0);
        ctx.lineTo(body.w / 2 - 5, 0);
        ctx.stroke();
      }

      // Damage cracks.
      if (body.hp <= 2) {
        ctx.strokeStyle = "#29252a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, -body.h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(-8, body.h / 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawBackground = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#75c5f3");
      sky.addColorStop(0.7, "#d6f0ff");
      sky.addColorStop(1, "#f3f3d0");

      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Sun.
      ctx.fillStyle = "#ffe8a0";
      ctx.beginPath();
      ctx.arc(820, 82, 40, 0, Math.PI * 2);
      ctx.fill();

      // Distant hills.
      ctx.fillStyle = "#9bcf9b";
      ctx.beginPath();
      ctx.moveTo(0, 380);
      ctx.quadraticCurveTo(160, 220, 340, 370);
      ctx.quadraticCurveTo(530, 220, 720, 365);
      ctx.quadraticCurveTo(850, 280, 960, 350);
      ctx.lineTo(960, H);
      ctx.lineTo(0, H);
      ctx.fill();

      // Foreground hills.
      ctx.fillStyle = "#6eaf66";
      ctx.beginPath();
      ctx.moveTo(0, 425);
      ctx.quadraticCurveTo(240, 370, 460, 430);
      ctx.quadraticCurveTo(720, 370, 960, 420);
      ctx.lineTo(960, H);
      ctx.lineTo(0, H);
      ctx.fill();

      ctx.fillStyle = "#6c9e45";
      ctx.fillRect(0, GROUND, W, H - GROUND);

      ctx.fillStyle = "#9bc96a";
      ctx.fillRect(0, GROUND, W, 7);

      // Clouds.
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (const [x, y] of [[170, 95], [390, 145], [680, 120]] as number[][]) {
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.arc(x + 22, y - 9, 24, 0, Math.PI * 2);
        ctx.arc(x + 49, y, 17, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawSlingshot = () => {
      // Back fork.
      ctx.lineCap = "round";
      ctx.strokeStyle = "#724326";
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(133, 465);
      ctx.lineTo(147, 345);
      ctx.lineTo(170, 465);
      ctx.stroke();

      ctx.strokeStyle = "#bd8753";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(147, 345);
      ctx.lineTo(147, 465);
      ctx.stroke();

      // Front fork.
      ctx.strokeStyle = "#754729";
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(165, 465);
      ctx.lineTo(178, 345);
      ctx.stroke();

      // Elastic bands.
      const p = pullRef.current;
      ctx.strokeStyle = "#553a29";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(147, 345);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(178, 345);
      ctx.stroke();
    };

    const drawScope = () => {
      if (!draggingRef.current || !showTrajectory) return;

      const p = pullRef.current;
      let x = p.x;
      let y = p.y;
      let vx = (SLING.x - p.x) * 0.17;
      let vy = (SLING.y - p.y) * 0.17;

      // Predict the flight path using the same gravity as the game.
      for (let i = 0; i < 34; i++) {
        x += vx * 0.85;
        y += vy * 0.85;
        vy += 0.42;
        vx *= 0.997;

        if (y > GROUND || x > W || y < 0) break;

        ctx.fillStyle = `rgba(40,55,65,${0.75 - i * 0.016})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, 5 - i * 0.08), 0, Math.PI * 2);
        ctx.fill();

        if (i % 4 === 0) {
          ctx.strokeStyle = "rgba(255,255,255,.65)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Aim strength indicator.
      const power = Math.min(
        100,
        Math.round(
          Math.hypot(SLING.x - p.x, SLING.y - p.y) / MAX_PULL * 100
        )
      );

      ctx.fillStyle = "rgba(20,25,35,.7)";
      roundedRect(25, 25, 160, 40, 9);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px Arial";
      ctx.fillText(`POWER ${power}%`, 38, 50);

      ctx.fillStyle = "#f0c45f";
      ctx.fillRect(105, 41, 65 * power / 100, 9);
    };

    const collideBirdWithBlock = (bird: Body, b: Body) => {
      if (!b.alive || b.kind !== "block") return;

      const nearestX = Math.max(b.x, Math.min(bird.x, b.x + b.w));
      const nearestY = Math.max(b.y, Math.min(bird.y, b.y + b.h));
      const dx = bird.x - nearestX;
      const dy = bird.y - nearestY;

      if (dx * dx + dy * dy < (bird.radius ?? 17) ** 2) {
        const impact = Math.hypot(bird.vx, bird.vy);

        if (impact > 1.5) {
          b.hp -= Math.max(1, Math.floor(impact / 7));
          b.vx += bird.vx * 0.22;
          b.vy += bird.vy * 0.16 - 2;
          bird.vx *= 0.55;
          bird.vy *= 0.55;

          if (b.hp <= 0) {
            b.alive = false;
            scoreRef.current += b.material === "stone" ? 250 : 150;
            setScore(scoreRef.current);
          }
        }

        if (impact > 2.5) {
          bird.vx *= 0.72;
          bird.vy *= 0.72;
        }
      }
    };

    const updateWorld = (dt: number) => {
      const bodies = worldRef.current;
      const bird = birdRef.current;
      const step = Math.min(dt / 16.67, 2);

      for (const b of bodies) {
        if (!b.alive) continue;

        b.vy += 0.42 * step;
        b.x += b.vx * step;
        b.y += b.vy * step;

        b.vx *= Math.pow(0.992, step);
        b.vy *= Math.pow(0.997, step);

        if (b.kind === "block" || b.kind === "pig") {
          if (b.y + b.h > GROUND) {
            b.y = GROUND - b.h;
            b.vy *= -0.15;
            b.vx *= 0.85;
          }

          if (b.x < 0) {
            b.x = 0;
            b.vx *= -0.3;
          }
          if (b.x + b.w > W) {
            b.x = W - b.w;
            b.vx *= -0.3;
          }
        }

        if (b.kind === "pig" && Math.abs(b.vx) + Math.abs(b.vy) > 3) {
          b.hp -= 0.025 * step;
          if (b.hp <= 0) {
            b.alive = false;
            scoreRef.current += 500;
            setScore(scoreRef.current);
          }
        }
      }

      // Basic block-to-block collision and weight transfer.
      const blocks = bodies.filter((b) => b.alive && b.kind === "block");

      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];

          const overlapX =
            Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY =
            Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

          if (overlapX > 0 && overlapY > 0) {
            if (overlapY < overlapX) {
              const push = overlapY / 2;
              if (a.y < b.y) {
                a.y -= push;
                b.y += push;
              } else {
                a.y += push;
                b.y -= push;
              }

              const impact = Math.abs(a.vy - b.vy);
              if (impact > 3) {
                a.hp -= impact * 0.08;
                b.hp -= impact * 0.08;
              }

              const velocity = a.vy;
              a.vy = b.vy * 0.35;
              b.vy = velocity * 0.35;
              a.vx += b.vx * 0.04;
              b.vx += a.vx * 0.04;
            }
          }
        }
      }

      // Birds damage blocks and pigs.
      if (bird?.alive && launchedRef.current) {
        for (const b of bodies) {
          if (!b.alive) continue;

          if (b.kind === "block") {
            collideBirdWithBlock(bird, b);
          }

          if (b.kind === "pig") {
            const distance = Math.hypot(
              bird.x - (b.x + b.w / 2),
              bird.y - (b.y + b.h / 2)
            );

            if (distance < 30) {
              b.alive = false;
              scoreRef.current += 500;
              setScore(scoreRef.current);
              bird.vx *= 0.65;
              bird.vy *= 0.65;
            }
          }
        }

        if (bird.y > GROUND - 18) {
          bird.y = GROUND - 18;
          bird.vy *= -0.25;
          bird.vx *= 0.7;
        }

        if (
          bird.x < -50 ||
          bird.x > W + 50 ||
          bird.y > H + 50 ||
          bird.y < -100 ||
          (Math.abs(bird.vx) < 0.25 && Math.abs(bird.vy) < 0.3 && bird.y > GROUND - 40)
        ) {
          bird.alive = false;
          launchedRef.current = false;
          birdRef.current = null;

          if (birdQueueRef.current > 0) {
            createBird();
            setMessage("Next bird ready. Take another shot.");
          } else {
            const remaining = bodies.some((b) => b.alive && b.kind === "pig");
            if (remaining) {
              setLost(true);
              setMessage("Out of birds! Try the level again.");
            }
          }
        }
      }

      // Debris destroys pigs when it falls onto them.
      for (const b of bodies) {
        if (!b.alive || b.kind !== "block") continue;

        for (const target of bodies) {
          if (!target.alive || target.kind !== "pig") continue;

          const overlap =
            b.x < target.x + target.w &&
            b.x + b.w > target.x &&
            b.y < target.y + target.h &&
            b.y + b.h > target.y;

          if (overlap && Math.abs(b.vy) > 2) {
            target.hp -= 1;
            b.vy *= -0.15;

            if (target.hp <= 0) {
              target.alive = false;
              scoreRef.current += 500;
              setScore(scoreRef.current);
            }
          }
        }
      }

      const pigsRemain = bodies.some((b) => b.alive && b.kind === "pig");

      if (!pigsRemain && !completedRef.current) {
        void awardLevel();
      }
    };

    const render = (time: number) => {
      if (!running) return;

      const dt = lastTimeRef.current ? time - lastTimeRef.current : 16.67;
      lastTimeRef.current = time;

      if (launchedRef.current) {
        updateWorld(dt);
      }

      ctx.clearRect(0, 0, W, H);
      drawBackground();

      // Wooden slingshot sits behind the bird.
      drawSlingshot();

      for (const body of worldRef.current) {
        if (!body.alive) continue;

        if (body.kind === "block") {
          drawBlock(body);
        } else if (body.kind === "pig") {
          drawPig(
            body.x + body.w / 2,
            body.y + body.h / 2,
            body.radius ?? 17
          );
        }
      }

      if (birdRef.current?.alive) {
        drawBird(
          birdRef.current.x,
          birdRef.current.y,
          Math.atan2(birdRef.current.vy, birdRef.current.vx)
        );
      }

      if (!launchedRef.current) {
        drawScope();
      }

      // Bird queue at the bottom left.
      for (let i = 0; i < birdQueueRef.current; i++) {
        ctx.globalAlpha = 0.85;
        drawBird(35 + i * 39, 510, 0);
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [screen, skin.colour, showTrajectory, createBird]);

  const restartLevel = () => {
    startLevel(activeLevel);
  };

  if (!loaded) {
    return (
      <main className="loading">
        <h1>🐦 Slingshot Adventures</h1>
        <p>Loading your game...</p>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">🎮 Keith&apos;s Games</Link>
        <div className="nav-label">SLINGSHOT ADVENTURES</div>

        <button onClick={() => setScreen("home")}>⌂ Dashboard</button>
        <button onClick={() => setScreen("levels")}>▦ Levels</button>
        <button onClick={() => setScreen("shop")}>🛍️ Bird shop</button>

        <div className="side-bottom">
          <div className="avatar">K</div>
          <div>
            <strong>Keith</strong>
            <small>{userId ? "Signed in" : "Guest player"}</small>
          </div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <small>KEITH&apos;S GAMES ARCADE</small>
            <h1>Slingshot Adventures</h1>
          </div>
          <div className="balance">🪙 {coins.toLocaleString()}</div>
        </header>

        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        {screen === "home" && (
          <section className="hero">
            <div>
              <span>THE FORTRESS SMASHING ADVENTURE</span>
              <h2>Pull back. Aim. <em>Destroy!</em></h2>
              <p>
                Knock down the towers, break through stone and glass,
                and take out every pig.
              </p>
              <button className="primary" onClick={() => startLevel(unlockedLevels)}>
                Continue level {unlockedLevels} →
              </button>
            </div>
            <div className="hero-bird">🐦</div>
          </section>
        )}

        {screen === "home" && (
          <>
            <div className="stats">
              <div><strong>{completedLevels.length}/10</strong><span>Levels completed</span></div>
              <div><strong>{coins}</strong><span>Account coins</span></div>
              <div><strong>{unlockedLevels}/10</strong><span>Levels unlocked</span></div>
              <div><strong>{Object.keys(bestScores).length}</strong><span>Best scores</span></div>
            </div>

            <h2 className="section-title">Your adventure</h2>
            <div className="level-grid">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  disabled={level > unlockedLevels}
                  onClick={() => startLevel(level)}
                  className="level-card"
                >
                  <span>{completedLevels.includes(level) ? "🏆" : "🎯"}</span>
                  <strong>Level {level}</strong>
                  <small>{level > unlockedLevels ? "Locked" : completedLevels.includes(level) ? "Completed" : "Ready"}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {screen === "levels" && (
          <>
            <h2 className="section-title">Choose your level</h2>
            <div className="level-grid">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                <button
                  key={level}
                  disabled={level > unlockedLevels}
                  onClick={() => startLevel(level)}
                  className="level-card"
                >
                  <span>{level > unlockedLevels ? "🔒" : completedLevels.includes(level) ? "🏆" : "🎯"}</span>
                  <strong>Level {level}</strong>
                  <small>{bestScores[level] ? `${bestScores[level]} points` : "Play level"}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {screen === "shop" && (
          <>
            <h2 className="section-title">Bird collection</h2>
            <p className="muted">Unlock new bird designs and special abilities.</p>
            <div className="shop-grid">
              {skins.map((item) => {
                const owned = unlockedSkins.includes(item.id);
                return (
                  <article className="skin-card" key={item.id}>
                    <div className="skin-art" style={{ color: item.colour }}>{item.emoji}</div>
                    <h3>{item.name}</h3>
                    <p>{item.id === "fire" ? "Area damage burst" : item.id === "ice" ? "Powerful speed boost" : item.id === "nature" ? "Jumping ability" : "Special bird design"}</p>
                    <button
                      disabled={busy || (!owned && coins < item.price)}
                      onClick={() => void buySkin(item)}
                    >
                      {selectedSkin === item.id ? "✓ Equipped" : owned ? "Equip" : `🪙 ${item.price}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {screen === "game" && (
          <section className="game">
            <div className="game-head">
              <div>
                <small>FORTRESS ASSAULT</small>
                <h2>Level {activeLevel}</h2>
              </div>
              <div className="game-metrics">
                <span>⭐ {score.toLocaleString()}</span>
                <span>🎯 {shots} shots</span>
                <span>🐦 {birdsLeft} birds left</span>
              </div>
            </div>

            <div className="canvas-wrap">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={releaseBird}
                onPointerCancel={releaseBird}
              />
            </div>

            <div className="game-toolbar">
              <button onClick={restartLevel}>↻ Restart level</button>
              <button onClick={() => setShowTrajectory((v) => !v)}>
                {showTrajectory ? "Hide scope" : "Show scope"}
              </button>
              <button
                onClick={activateAbility}
                disabled={!birdRef.current || !launchedRef.current || abilityUsedRef.current}
              >
                ✨ Use bird ability
              </button>
              <button onClick={() => setScreen("levels")}>Exit</button>
            </div>

            <p className="message">{message}</p>
            <p className="muted">
              Pull the bird backwards. The dotted scope predicts its flight.
              Release to fire. Use the ability button while the bird is flying.
            </p>

            <div className="material-guide">
              <span>🪵 Wood — medium strength</span>
              <span>💎 Glass — breaks easily</span>
              <span>🪨 Stone — very strong</span>
            </div>

            {won && (
              <div className="result">
                <div>🏆</div>
                <h2>All pigs defeated!</h2>
                <p>Final score: {score.toLocaleString()}</p>
                <p>🪙 Level reward: 30 coins on first completion</p>
                <button className="primary" onClick={() => startLevel(Math.min(10, activeLevel + 1))}>
                  {activeLevel === 10 ? "Play again" : "Next level →"}
                </button>
                <button onClick={() => setScreen("levels")}>Level selection</button>
              </div>
            )}

            {lost && (
              <div className="result">
                <div>💥</div>
                <h2>Out of birds!</h2>
                <p>There are still pigs in the fortress.</p>
                <button className="primary" onClick={restartLevel}>Try again</button>
              </div>
            )}
          </section>
        )}

        <footer>Keith&apos;s Games · Slingshot Adventures</footer>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #10131c; }
        button { font: inherit; cursor: pointer; }
        button:disabled { opacity: .4; cursor: not-allowed; }
      `}</style>

      <style jsx>{`
        .app { min-height: 100vh; display: flex; background: #10131c; color: #f5f6fa; font-family: Arial, sans-serif; }
        .loading { min-height: 100vh; display: grid; place-content: center; background: #10131c; color: white; text-align: center; }
        .sidebar { width: 235px; flex-shrink: 0; background: #191e2b; border-right: 1px solid #303648; padding: 25px 17px; display: flex; flex-direction: column; min-height: 100vh; }
        .brand { color: white; text-decoration: none; font-size: 17px; font-weight: 900; margin: 5px 5px 55px; }
        .nav-label { color: #8d96aa; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; margin: 0 8px 15px; }
        .sidebar > button { border: 0; background: transparent; color: #c0c6d5; padding: 14px 12px; text-align: left; border-radius: 9px; margin-bottom: 5px; }
        .sidebar > button:hover { background: #303047; color: white; }
        .side-bottom { margin-top: auto; border-top: 1px solid #34394a; padding-top: 18px; display: flex; gap: 11px; align-items: center; }
        .avatar { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 50%; background: #4d987f; font-weight: 900; }
        .side-bottom strong, .side-bottom small { display: block; }
        .side-bottom small { color: #9ba4b8; margin-top: 4px; }
        .main { min-width: 0; flex: 1; padding: 28px 35px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
        .topbar small, .game-head small { color: #929bb0; letter-spacing: 1.5px; font-size: 10px; font-weight: 900; }
        h1 { font-size: 24px; margin: 7px 0 0; }
        .balance { background: #30291b; border: 1px solid #65512a; color: #f4d17b; border-radius: 10px; padding: 12px 17px; font-weight: 900; }
        .notice { padding: 13px 15px; margin-bottom: 18px; background: #292541; border: 1px solid #514477; border-radius: 9px; color: #e1d8ff; }
        .notice button { float: right; border: 0; color: white; background: transparent; }
        .hero { min-height: 230px; padding: 35px; border-radius: 19px; background: linear-gradient(110deg, #354c62, #397b8c 60%, #4c9b80); display: flex; justify-content: space-between; align-items: center; overflow: hidden; }
        .hero span { color: #d4f2e9; font-size: 10px; letter-spacing: 1.5px; font-weight: 900; }
        .hero h2 { font-size: clamp(28px, 4vw, 43px); margin: 13px 0; }
        .hero em { color: #ffdf83; font-style: normal; }
        .hero p { color: #e1f2f1; max-width: 500px; line-height: 1.6; }
        .hero-bird { font-size: 105px; filter: drop-shadow(0 12px 10px #142c3566); }
        .primary { border: 0; border-radius: 9px; background: #f4d17b; color: #292216; font-weight: 900; padding: 13px 19px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 13px; margin: 24px 0 30px; }
        .stats > div { background: #1b2130; border: 1px solid #30384b; padding: 18px; border-radius: 12px; }
        .stats strong, .stats span { display: block; }
        .stats strong { font-size: 23px; margin-bottom: 7px; }
        .stats span { font-size: 11px; color: #a7b0c3; }
        .section-title { margin: 28px 0 16px; font-size: 21px; }
        .level-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 13px; }
        .level-card { background: #1b2130; border: 1px solid #343d51; color: white; border-radius: 12px; padding: 19px; display: grid; gap: 8px; text-align: left; }
        .level-card:hover { border-color: #e4c36f; transform: translateY(-2px); }
        .level-card span { font-size: 27px; }
        .level-card small { color: #a5aec0; }
        .muted { color: #a5aec0; line-height: 1.6; font-size: 13px; }
        .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
        .skin-card { background: #1b2130; border: 1px solid #343d51; border-radius: 13px; padding: 19px; text-align: center; }
        .skin-art { font-size: 57px; padding: 15px; }
        .skin-card p { color: #a5aec0; font-size: 12px; min-height: 30px; }
        .skin-card button, .game-toolbar button, .result > button:not(.primary) { border: 0; border-radius: 8px; padding: 11px 14px; background: #343d51; color: white; font-weight: 800; }
        .game { max-width: 1120px; margin: 0 auto; }
        .game-head { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 18px; }
        .game-head h2 { margin: 6px 0 0; }
        .game-metrics { display: flex; flex-wrap: wrap; gap: 12px; color: #f3d17a; font-weight: 800; font-size: 13px; }
        .canvas-wrap { width: 100%; border: 4px solid #343d51; border-radius: 13px; overflow: hidden; background: #9bd9f4; touch-action: none; }
        canvas { width: 100%; height: auto; display: block; touch-action: none; cursor: crosshair; }
        .game-toolbar { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 14px; }
        .game-toolbar button:hover { background: #4a5570; }
        .message { color: #f3d17a; font-weight: 800; margin: 16px 0 7px; }
        .material-guide { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 17px; color: #c3cada; font-size: 12px; }
        .result { margin-top: 22px; padding: 24px; border: 1px solid #5b704d; border-radius: 14px; background: #202e27; text-align: center; }
        .result > div { font-size: 42px; }
        .result h2 { margin: 8px; }
        .result p { color: #c1d6c7; }
        .result button { margin: 5px; }
        footer { color: #758096; font-size: 11px; padding: 35px 0 10px; }
        @media (max-width: 850px) {
          .sidebar { width: 185px; }
          .main { padding: 22px 18px; }
          .stats { grid-template-columns: repeat(2, 1fr); }
          .hero-bird { font-size: 70px; }
        }
        @media (max-width: 620px) {
          .app { display: block; }
          .sidebar { width: 100%; min-height: auto; height: auto; padding: 12px; display: flex; flex-direction: row; align-items: center; gap: 6px; overflow-x: auto; }
          .brand { margin: 0 12px 0 0; white-space: nowrap; }
          .nav-label, .side-bottom { display: none; }
          .sidebar > button { white-space: nowrap; padding: 10px; }
          .main { padding: 17px 12px; }
          .topbar h1 { font-size: 19px; }
          .hero { padding: 23px; }
          .hero-bird { font-size: 48px; }
          .game-head { display: block; }
          .game-metrics { margin-top: 12px; }
          .stats { gap: 8px; }
          .stats > div { padding: 13px; }
        }
      `}</style>
    </main>
  );
}
