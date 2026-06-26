"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type GameStatus = "ready" | "playing" | "gameover" | "clear";
type RankingStatus = "idle" | "loading" | "error";

type RankingTrack = {
  snapshotDate: string;
  rank: number;
  artistName: string;
  score: number;
  latestTrackName: string | null;
  spotifyEmbedUrl: string | null;
  artistImageUrl: string | null;
};

type RankingResponse = {
  snapshotDate: string | null;
  items: RankingTrack[];
  error?: string;
};

type DreamCorePayload = Record<string, unknown>;

type SpotifyIframeOptions = {
  uri: string;
  width?: string | number;
  height?: string | number;
  theme?: "dark" | "white";
};

type SpotifyEmbedController = {
  play: () => Promise<void> | void;
  resume?: () => Promise<void> | void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: SpotifyIframeOptions,
    callback: (controller: SpotifyEmbedController) => void
  ) => void;
};

declare global {
  interface Window {
    DreamCoreSDK2?: {
      gameComplete?: (payload: DreamCorePayload) => void;
      gameOver?: (payload: DreamCorePayload) => void;
      retry?: (payload: DreamCorePayload) => void;
    };
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    webkitAudioContext?: typeof AudioContext;
  }
}

type ActiveEffects = {
  speedUp: number;
  speedDown: number;
  shrink: number;
  reverse: number;
};

type ItemId = keyof ActiveEffects | "moreBalls" | "addObstacles";
type EventMessageKey =
  | "exit"
  | "night"
  | "speedUp"
  | "speedDown"
  | "moreBalls"
  | "shrink"
  | "addObstacles"
  | "reverse";

type ItemType = {
  id: ItemId;
  msg: EventMessageKey;
};

type Obstacle = {
  group: THREE.Group;
  box: THREE.Box3;
};

type Ball = {
  group: THREE.Group;
  isMain: boolean;
  baseSize: number;
  speedMultiplier: number;
  lifeTime?: number;
  eatPauseTimer: number;
};

type GameItem = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  particles: THREE.Group;
  pMat: THREE.MeshBasicMaterial;
  mat: THREE.MeshStandardMaterial;
  type: ItemType;
  id: number;
  hue: number;
};

const EVENT_MESSAGES: Record<EventMessageKey, string> = {
  exit: "脱出口が出現！",
  night: "NIGHT PHASE!",
  speedUp: "スピードアップ！",
  speedDown: "スピードダウン...",
  moreBalls: "ボール増加！",
  shrink: "ボール縮小！",
  addObstacles: "障害物増加！",
  reverse: "操作反転！",
};

const ITEM_TYPES: ItemType[] = [
  { id: "speedUp", msg: "speedUp" },
  { id: "speedDown", msg: "speedDown" },
  { id: "moreBalls", msg: "moreBalls" },
  { id: "shrink", msg: "shrink" },
  { id: "addObstacles", msg: "addObstacles" },
  { id: "reverse", msg: "reverse" },
];

const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
let spotifyIframeApi: SpotifyIframeApi | null = null;
let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | null = null;

class SynthAudio {
  private ctx: AudioContext | null = null;

  init() {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!this.ctx) this.ctx = new AudioContextCtor();
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  play(freq: number, endFreq: number, duration: number, type: OscillatorType = "square", vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playStart() {
    this.play(400, 800, 0.3, "square", 0.1);
  }

  playSpawn() {
    this.play(100, 50, 0.2, "sawtooth", 0.1);
  }

  playEvent() {
    this.play(600, 1200, 0.4, "sine", 0.1);
  }

  playGameOver() {
    this.play(200, 40, 0.8, "sawtooth", 0.15);
  }

  playScream() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }
}

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function withSpotifyAutoplay(embedUrl: string) {
  try {
    const url = new URL(embedUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("utm_source", "generator");
    return url.toString();
  } catch {
    const separator = embedUrl.includes("?") ? "&" : "?";
    return `${embedUrl}${separator}autoplay=1&utm_source=generator`;
  }
}

function toSpotifyUri(embedUrl: string | null) {
  if (!embedUrl) return null;

  try {
    const url = new URL(embedUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const typeIndex = segments.findIndex((segment) =>
      ["album", "episode", "playlist", "show", "track"].includes(segment)
    );
    const type = segments[typeIndex];
    const id = segments[typeIndex + 1];
    if (type && id) {
      return `spotify:${type}:${id}`;
    }
  } catch {
    const match = embedUrl.match(/(?:album|episode|playlist|show|track)\/([A-Za-z0-9]+)/);
    if (match?.[0] && match[1]) {
      const type = match[0].split("/")[0];
      return `spotify:${type}:${match[1]}`;
    }
  }

  return null;
}

function loadSpotifyIframeApi() {
  if (spotifyIframeApi) {
    return Promise.resolve(spotifyIframeApi);
  }
  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise;
  }

  spotifyIframeApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const previousReady = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api: SpotifyIframeApi) => {
      spotifyIframeApi = api;
      previousReady?.(api);
      resolve(api);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SPOTIFY_IFRAME_API_SRC}"]`
    );
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      spotifyIframeApiPromise = null;
      reject(new Error("Spotify iFrame API failed to load"));
    };
    document.body.appendChild(script);
  });

  return spotifyIframeApiPromise;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material?.dispose();
    }
  });
}

function TrackSummary({ track }: { track: RankingTrack }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/15 bg-black/40">
        {track.artistImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.artistImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-amber-300">{track.rank}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-300">{track.rank}位</p>
        <p className="truncate text-sm font-bold text-white">{track.artistName}</p>
        <p className="truncate text-xs text-zinc-200">♪ {track.latestTrackName ?? "最新曲"}</p>
      </div>
    </div>
  );
}

function SpotifyMiniPlayer({
  onPlayReady,
  track,
  visible,
}: {
  onPlayReady: (play: (() => void) | null) => void;
  track: RankingTrack;
  visible: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { artistName, latestTrackName, rank, spotifyEmbedUrl } = track;

  useEffect(() => {
    const container = containerRef.current;
    const uri = toSpotifyUri(spotifyEmbedUrl);
    let cancelled = false;
    let controller: SpotifyEmbedController | null = null;

    onPlayReady(null);

    if (!container || !uri) {
      return () => undefined;
    }

    loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled || !containerRef.current) return;

        api.createController(
          containerRef.current,
          {
            height: 80,
            theme: "dark",
            uri,
            width: "100%",
          },
          (createdController) => {
            controller = createdController;
            if (cancelled) {
              return;
            }

            onPlayReady(() => {
              const playResult = controller?.play();
              if (playResult instanceof Promise) {
                void playResult.catch(() => undefined);
              }
              window.setTimeout(() => {
                const resumeResult = controller?.resume?.();
                if (resumeResult instanceof Promise) {
                  void resumeResult.catch(() => undefined);
                }
              }, 250);
            });
          }
        );
      })
      .catch(() => {
        if (cancelled || !containerRef.current || !spotifyEmbedUrl) return;

        const iframe = document.createElement("iframe");
        iframe.src = withSpotifyAutoplay(spotifyEmbedUrl);
        iframe.title = `${artistName} - ${latestTrackName ?? "Spotify"}`;
        iframe.width = "100%";
        iframe.height = "80";
        iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        iframe.loading = "eager";
        iframe.className = "block";
        containerRef.current.appendChild(iframe);
        onPlayReady(() => undefined);
      });

    return () => {
      cancelled = true;
      onPlayReady(null);
      controller = null;
    };
  }, [artistName, latestTrackName, onPlayReady, rank, spotifyEmbedUrl]);

  return (
    <div
      className={`pointer-events-auto absolute bottom-3 left-1/2 w-[calc(100%-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-md border border-white/20 bg-black/70 shadow-2xl backdrop-blur transition-opacity ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">BGM</p>
          <p className="truncate text-xs font-bold text-white">
            {rank}位 {artistName} / {latestTrackName ?? "最新曲"}
          </p>
        </div>
      </div>
      <div key={`${rank}-${spotifyEmbedUrl}`} ref={containerRef} />
    </div>
  );
}

export function VoxelEscapeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotifyPlayRef = useRef<(() => void) | null>(null);
  const startGameRef = useRef<(track: RankingTrack | null) => void>(() => {});
  const rankingItemsRef = useRef<RankingTrack[]>([]);
  const nextBgmIndexRef = useRef(0);

  const [gameStatus, setGameStatus] = useState<GameStatus>("ready");
  const [hudText, setHudText] = useState("TIME: 0s / 60s");
  const [eventText, setEventText] = useState("");
  const [eventToken, setEventToken] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [selectedBgm, setSelectedBgm] = useState<RankingTrack | null>(null);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<RankingTrack | null>(null);
  const [spotifyPlayerReady, setSpotifyPlayerReady] = useState(false);
  const [rankingStatus, setRankingStatus] = useState<RankingStatus>("loading");
  const [rankingMessage, setRankingMessage] = useState("");
  const [rankingDate, setRankingDate] = useState<string | null>(null);
  const [rankingItems, setRankingItems] = useState<RankingTrack[]>([]);

  useEffect(() => {
    rankingItemsRef.current = rankingItems.slice(0, 10);
    if (rankingItems.length > 0) {
      nextBgmIndexRef.current %= rankingItems.length;
    } else {
      nextBgmIndexRef.current = 0;
    }
  }, [rankingItems]);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      try {
        setRankingStatus("loading");
        const response = await fetch("/api/imakite/daily-top10", { cache: "no-store" });
        const payload = (await response.json()) as RankingResponse;
        if (!active) return;
        if (!response.ok) {
          throw new Error(payload.error ?? "ランキングの取得に失敗しました。");
        }
        setRankingDate(payload.snapshotDate);
        setRankingItems(payload.items.slice(0, 10));
        setRankingStatus("idle");
      } catch (error) {
        if (!active) return;
        setRankingStatus("error");
        setRankingMessage(error instanceof Error ? error.message : "ランキングの取得に失敗しました。");
      }
    }

    void loadRanking();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audio = new SynthAudio();
    let gameState: GameStatus = "ready";
    let scoreTime = 0;
    let gameTimer = 0;
    let ballGrowthTimer = 0;
    let inputLockUntil = 0;
    let baseBallSpeed = 2.5;
    let itemSpawnTimer = 2.0;
    let isNightPhase = false;
    let lastHudSecond = -1;
    let flashTimer: number | null = null;

    let balls: Ball[] = [];
    let obstacles: Obstacle[] = [];
    let items: GameItem[] = [];
    let activeEffects: ActiveEffects = { speedUp: 0, speedDown: 0, shrink: 0, reverse: 0 };
    let exitGate: THREE.Group | null = null;
    let starsGroup: THREE.Group | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

    const viewSize = 12;
    const getAspect = () => Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
    const camera = new THREE.OrthographicCamera(
      -viewSize * getAspect(),
      viewSize * getAspect(),
      viewSize,
      -viewSize,
      0.1,
      200
    );
    const camOffset = new THREE.Vector3(20, 25, 20);
    camera.position.copy(camOffset);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const ctx = floorCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#7cb342";
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = "#689f38";
      for (let i = 0; i < 8; i += 1) {
        for (let j = 0; j < 8; j += 1) {
          if ((i + j) % 2 === 0) ctx.fillRect(i * 32, j * 32, 32, 32);
        }
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(20, 20);
    floorTex.magFilter = THREE.NearestFilter;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const player = new THREE.Group();
    const pBodyMat = new THREE.MeshStandardMaterial({ color: 0x1976d2 });
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), pBodyMat);
    pBody.position.y = 0.4;
    pBody.castShadow = true;

    const pHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xffccaa })
    );
    pHead.position.y = 1.2;
    pHead.castShadow = true;

    const pHair = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.3, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x5d4037 })
    );
    pHair.position.set(0, 1.55, 0);

    const pLegL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), pBodyMat);
    pLegL.position.set(0.2, 0.2, 0);
    pLegL.castShadow = true;
    const pLegR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), pBodyMat);
    pLegR.position.set(-0.2, 0.2, 0);
    pLegR.castShadow = true;
    const pArmL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), pBodyMat);
    pArmL.position.set(0.5, 0.6, 0);
    pArmL.castShadow = true;
    const pArmR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), pBodyMat);
    pArmR.position.set(-0.5, 0.6, 0);
    pArmR.castShadow = true;

    player.add(pBody, pHead, pHair, pLegL, pLegR, pArmL, pArmR);
    player.userData = { body: pBody, legL: pLegL, legR: pLegR, armL: pArmL, armR: pArmR };
    scene.add(player);

    const setLocalGameState = (state: GameStatus) => {
      gameState = state;
      setGameStatus(state);
    };

    const updateHud = (force = false) => {
      const second = Math.floor(scoreTime);
      if (!force && second === lastHudSecond) return;
      lastHudSecond = second;
      setHudText(`TIME: ${second}s / 60s`);
    };

    const showEvent = (key: EventMessageKey) => {
      setEventText(EVENT_MESSAGES[key]);
      setEventToken((value) => value + 1);
      audio.playEvent();
    };

    const chooseNextBgm = () => {
      const tracks = rankingItemsRef.current;
      if (tracks.length === 0) {
        setSelectedBgm(null);
        return;
      }

      const index = nextBgmIndexRef.current % tracks.length;
      setSelectedBgm(tracks[index]);
      nextBgmIndexRef.current = (index + 1) % tracks.length;
    };

    function createStars() {
      if (starsGroup) return;
      starsGroup = new THREE.Group();
      const starGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let i = 0; i < 150; i += 1) {
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set((Math.random() - 0.5) * 150, 10 + Math.random() * 30, (Math.random() - 0.5) * 150);
        starsGroup.add(star);
      }
      scene.add(starsGroup);
    }

    function addSingleObstacle() {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      if (Math.abs(x) < 6 && Math.abs(z) < 6) return;

      const group = new THREE.Group();
      const type = Math.random();
      let box: THREE.Box3;

      if (type < 0.6) {
        const trunkH = 1.0 + Math.random();
        const trunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, trunkH, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x795548 })
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const leavesSize = 1.5 + Math.random() * 1.5;
        const leaves = new THREE.Mesh(
          new THREE.BoxGeometry(leavesSize, leavesSize, leavesSize),
          new THREE.MeshStandardMaterial({ color: 0x4caf50 })
        );
        leaves.position.y = trunkH + leavesSize / 2 - 0.2;
        leaves.castShadow = true;
        leaves.receiveShadow = true;

        group.add(trunk, leaves);
        box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, trunkH / 2, z),
          new THREE.Vector3(0.8, trunkH, 0.8)
        );
      } else {
        const s = 1.0 + Math.random() * 1.5;
        const rock = new THREE.Mesh(
          new THREE.BoxGeometry(s, s * 0.8, s),
          new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.9 })
        );
        rock.position.y = s * 0.4;
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.rotation.y = Math.random() * Math.PI;

        group.add(rock);
        box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, s * 0.4, z),
          new THREE.Vector3(s * 0.9, s * 0.8, s * 0.9)
        );
      }

      group.position.set(x, 0, z);
      scene.add(group);
      obstacles.push({ group, box });
    }

    function createObstacles() {
      obstacles.forEach((obstacle) => scene.remove(obstacle.group));
      obstacles = [];
      for (let i = 0; i < 100; i += 1) {
        addSingleObstacle();
      }
    }

    function createBallGroup(size: number) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
      const top = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      const bottom = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        mat
      );
      top.castShadow = true;
      bottom.castShadow = true;

      const topPivot = new THREE.Group();
      topPivot.add(top);
      const bottomPivot = new THREE.Group();
      bottomPivot.add(bottom);

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const eyeSize = size * 0.3;
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, eyeSize), eyeMat);
      eyeL.position.set(size * 0.4, size * 0.5, size * 0.7);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, eyeSize), eyeMat);
      eyeR.position.set(-size * 0.4, size * 0.5, size * 0.7);
      topPivot.add(eyeL, eyeR);

      group.add(topPivot, bottomPivot);
      group.userData = { topPivot, bottomPivot };
      return group;
    }

    function spawnBall() {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20;
      const x = player.position.x + Math.cos(angle) * dist;
      const z = player.position.z + Math.sin(angle) * dist;

      const group = createBallGroup(1.0);
      group.position.set(x, 1.0, z);
      scene.add(group);
      balls.push({ group, isMain: true, baseSize: 1.0, speedMultiplier: 1.0, eatPauseTimer: 0 });
      audio.playSpawn();
    }

    function spawnSubBall() {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10;
      const x = player.position.x + Math.cos(angle) * dist;
      const z = player.position.z + Math.sin(angle) * dist;

      const group = createBallGroup(0.6);
      group.position.set(x, 0.6, z);
      scene.add(group);
      balls.push({ group, isMain: false, baseSize: 0.6, speedMultiplier: 1.2, lifeTime: 8.0, eatPauseTimer: 0 });
    }

    function spawnItem() {
      if (items.length >= 5) return;
      const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) return;

      const group = new THREE.Group();
      group.position.set(x, 1, z);

      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
        roughness: 0.1,
        metalness: 0.5,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
      mesh.castShadow = true;
      group.add(mesh);

      const light = new THREE.PointLight(0xffffff, 2.0, 15);
      light.position.set(0, 1.5, 0);
      group.add(light);

      const particles = new THREE.Group();
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      for (let i = 0; i < 8; i += 1) {
        const p = new THREE.Mesh(pGeo, pMat);
        const angle = (i / 8) * Math.PI * 2;
        p.position.set(Math.cos(angle) * 1.2, 0, Math.sin(angle) * 1.2);
        particles.add(p);
      }
      group.add(particles);

      scene.add(group);
      items.push({ group, mesh, light, particles, pMat, mat, type, id: Math.random(), hue: Math.random() });
    }

    function applyItem(type: ItemType) {
      showEvent(type.msg);
      if (type.id === "moreBalls") {
        for (let i = 0; i < 3; i += 1) spawnSubBall();
      } else if (type.id === "shrink") {
        ballGrowthTimer = 0;
      } else if (type.id === "addObstacles") {
        for (let i = 0; i < 15; i += 1) addSingleObstacle();
      } else {
        activeEffects[type.id] = 5.0;
      }
    }

    function spawnExit() {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 20, 16), mat);
      mesh.position.y = 10;
      group.add(mesh);

      let ex = (Math.random() - 0.5) * 60;
      const ez = (Math.random() - 0.5) * 60;
      if (Math.abs(ex) < 10) ex += 20;
      group.position.set(ex, 0, ez);
      scene.add(group);
      exitGate = group;
      showEvent("exit");
    }

    function gameClear() {
      if (gameState !== "playing") return;
      setLocalGameState("clear");
      setNowPlayingTrack(null);
      audio.playEvent();
      window.DreamCoreSDK2?.gameComplete?.({ score: Math.floor(scoreTime) });
    }

    function gameOver() {
      if (gameState !== "playing") return;
      setLocalGameState("gameover");
      setNowPlayingTrack(null);
      audio.playScream();
      audio.playGameOver();
      const score = Math.floor(scoreTime);
      setFinalScore(score);
      chooseNextBgm();
      window.DreamCoreSDK2?.gameOver?.({ score, reason: "hit_ball" });
    }

    function resetAndStart(track: RankingTrack | null) {
      audio.init();
      audio.playStart();
      setNowPlayingTrack(track);
      setSelectedBgm(null);
      setFlashActive(false);
      setEventText("");
      setEventToken((value) => value + 1);

      player.position.set(0, 0, 0);
      player.rotation.set(0, 0, 0);
      camera.position.copy(camOffset);
      camera.lookAt(player.position);

      balls.forEach((ball) => scene.remove(ball.group));
      balls = [];
      items.forEach((item) => scene.remove(item.group));
      items = [];
      if (exitGate) {
        scene.remove(exitGate);
        exitGate = null;
      }

      activeEffects = { speedUp: 0, speedDown: 0, shrink: 0, reverse: 0 };
      itemSpawnTimer = 2.0;
      isNightPhase = false;
      scene.background = new THREE.Color(0x87ceeb);
      scene.fog?.color.setHex(0x87ceeb);
      if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.015;
      ambientLight.color.setHex(0xffffff);
      ambientLight.intensity = 0.6;
      dirLight.color.setHex(0xffffff);
      dirLight.intensity = 1.5;
      if (starsGroup) starsGroup.visible = false;

      createObstacles();
      spawnBall();

      scoreTime = 0;
      gameTimer = 0;
      ballGrowthTimer = 0;
      baseBallSpeed = 2.5;
      lastHudSecond = -1;
      updateHud(true);
      inputLockUntil = performance.now() + 250;
      setLocalGameState("playing");
    }

    startGameRef.current = resetAndStart;

    const keys: Record<string, boolean> = {
      w: false,
      a: false,
      s: false,
      d: false,
      arrowup: false,
      arrowleft: false,
      arrowdown: false,
      arrowright: false,
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!(key in keys)) return;
      keys[key] = true;
      if (gameState === "ready") resetAndStart(null);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key in keys) keys[key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let joyVector = { x: 0, y: 0 };
    let joyActive = false;
    let joyCenter = { x: 0, y: 0 };
    const joyZone = document.getElementById("voxel-joystick-zone");
    const joyKnob = document.getElementById("voxel-joystick-knob");

    const updateJoystick = (event: PointerEvent) => {
      if (!joyKnob) return;
      let dx = event.clientX - joyCenter.x;
      let dy = event.clientY - joyCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 50;
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      joyVector = { x: dx / maxDist, y: -dy / maxDist };
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!joyZone || performance.now() < inputLockUntil) return;
      if (gameState === "ready") resetAndStart(null);
      joyActive = true;
      joyZone.setPointerCapture(event.pointerId);
      const rect = joyZone.getBoundingClientRect();
      joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateJoystick(event);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!joyActive) return;
      updateJoystick(event);
    };

    const releaseJoystick = (event: PointerEvent) => {
      if (joyZone && joyZone.hasPointerCapture(event.pointerId)) {
        joyZone.releasePointerCapture(event.pointerId);
      }
      joyActive = false;
      joyVector = { x: 0, y: 0 };
      if (joyKnob) joyKnob.style.transform = "translate(0px, 0px)";
    };

    joyZone?.addEventListener("pointerdown", handlePointerDown);
    joyZone?.addEventListener("pointermove", handlePointerMove);
    joyZone?.addEventListener("pointerup", releaseJoystick);
    joyZone?.addEventListener("pointercancel", releaseJoystick);

    const clock = new THREE.Clock();

    function animate() {
      const dt = Math.min(clock.getDelta(), 0.1);

      if (gameState === "playing") {
        scoreTime += dt;
        gameTimer += dt;
        ballGrowthTimer += dt;
        updateHud();

        itemSpawnTimer -= dt;
        if (itemSpawnTimer <= 0) {
          spawnItem();
          itemSpawnTimer = 4.0;
        }

        for (const key of Object.keys(activeEffects) as Array<keyof ActiveEffects>) {
          if (activeEffects[key] > 0) activeEffects[key] -= dt;
        }

        if (gameTimer >= 60 && !exitGate) {
          spawnExit();
        }

        if (gameTimer >= 60 && !isNightPhase) {
          isNightPhase = true;
          showEvent("night");
          setFlashActive(true);
          if (flashTimer) window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => setFlashActive(false), 80);

          scene.background = new THREE.Color(0x0a0a2a);
          scene.fog?.color.setHex(0x0a0a2a);
          if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.02;
          ambientLight.color.setHex(0x404080);
          ambientLight.intensity = 0.3;
          dirLight.color.setHex(0x8080ff);
          dirLight.intensity = 0.5;

          createStars();
          if (starsGroup) starsGroup.visible = true;

          const ballsToAdd = 10 - balls.length;
          for (let i = 0; i < ballsToAdd; i += 1) spawnBall();
        }

        if (exitGate) {
          exitGate.rotation.y += dt;
          if (player.position.distanceTo(exitGate.position) < 3.0) {
            gameClear();
            renderer.render(scene, camera);
            return;
          }
        }

        let ix = 0;
        let iz = 0;
        if (keys.w || keys.arrowup) iz += 1;
        if (keys.s || keys.arrowdown) iz -= 1;
        if (keys.a || keys.arrowleft) ix -= 1;
        if (keys.d || keys.arrowright) ix += 1;

        if (ix === 0 && iz === 0) {
          ix = joyVector.x;
          iz = joyVector.y;
        }

        if (activeEffects.reverse > 0) {
          ix = -ix;
          iz = -iz;
        }

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (ix !== 0 || iz !== 0) {
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          forward.y = 0;
          forward.normalize();
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          right.y = 0;
          right.normalize();

          moveDir.addScaledVector(right, ix).addScaledVector(forward, iz);
          if (moveDir.lengthSq() > 0) moveDir.normalize();

          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          let diff = targetAngle - player.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          player.rotation.y += diff * 15 * dt;
        }

        let pSpeed = 7.0;
        if (activeEffects.speedUp > 0) pSpeed *= 1.5;
        if (activeEffects.speedDown > 0) pSpeed *= 0.5;

        if (moveDir.lengthSq() > 0) {
          const tryMove = (dx: number, dz: number) => {
            const nextPos = player.position.clone();
            nextPos.x += dx;
            nextPos.z += dz;
            const pBox = new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(nextPos.x, 0.5, nextPos.z),
              new THREE.Vector3(0.8, 1.0, 0.8)
            );
            let hit = false;
            for (const obs of obstacles) {
              if (pBox.intersectsBox(obs.box)) {
                hit = true;
                break;
              }
            }
            if (Math.abs(nextPos.x) > 48 || Math.abs(nextPos.z) > 48) hit = true;
            return !hit;
          };

          const dx = moveDir.x * pSpeed * dt;
          const dz = moveDir.z * pSpeed * dt;

          if (tryMove(dx, dz)) {
            player.position.x += dx;
            player.position.z += dz;
          } else if (tryMove(dx, 0)) {
            player.position.x += dx;
          } else if (tryMove(0, dz)) {
            player.position.z += dz;
          }

          const speedFactor = 15;
          pLegL.rotation.x = Math.sin(gameTimer * speedFactor) * 0.5;
          pLegR.rotation.x = Math.sin(gameTimer * speedFactor + Math.PI) * 0.5;
          pArmL.rotation.x = Math.sin(gameTimer * speedFactor + Math.PI) * 0.5;
          pArmR.rotation.x = Math.sin(gameTimer * speedFactor) * 0.5;
          pBody.rotation.y = Math.sin(gameTimer * speedFactor) * 0.1;
          pBody.position.y = 0.4 + Math.abs(Math.sin(gameTimer * speedFactor)) * 0.1;
        } else {
          pLegL.rotation.x = 0;
          pLegR.rotation.x = 0;
          pArmL.rotation.x = 0;
          pArmR.rotation.x = 0;
          pBody.rotation.y = 0;
          pBody.position.y = 0.4;
        }

        for (let i = items.length - 1; i >= 0; i -= 1) {
          const item = items[i];
          item.hue = (item.hue + dt * 0.8) % 1.0;
          item.mat.color.setHSL(item.hue, 1, 0.5);
          item.mat.emissive.setHSL(item.hue, 1, 0.5);
          item.light.color.setHSL(item.hue, 1, 0.5);
          item.pMat.color.setHSL(item.hue, 1, 0.6);

          const intensity = 1.5 + Math.sin(gameTimer * 8 + item.id * 10) * 0.5;
          item.mat.emissiveIntensity = intensity;
          item.light.intensity = intensity * 2.0;

          item.group.position.y = 1 + Math.sin(gameTimer * 3 + item.id) * 0.3;
          item.mesh.rotation.x += dt;
          item.mesh.rotation.y += dt * 1.5;
          item.particles.rotation.y -= dt * 2.0;
          item.particles.position.y = Math.sin(gameTimer * 5 + item.id) * 0.5;

          if (player.position.distanceTo(item.group.position) < 1.5) {
            applyItem(item.type);
            scene.remove(item.group);
            items.splice(i, 1);
          }
        }

        const pBoxFinal = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(player.position.x, 0.5, player.position.z),
          new THREE.Vector3(0.6, 1.0, 0.6)
        );

        for (let i = balls.length - 1; i >= 0; i -= 1) {
          const b = balls[i];
          if (b.lifeTime !== undefined) {
            b.lifeTime -= dt;
            if (b.lifeTime <= 0) {
              scene.remove(b.group);
              balls.splice(i, 1);
              continue;
            }
          }

          let currentScale = 1.0;
          let currentSpeed = baseBallSpeed;
          if (b.isMain) {
            currentScale = 1.0 + ballGrowthTimer * 0.1;
            currentSpeed = baseBallSpeed + ballGrowthTimer * 0.2;
          }

          let biteSpeed = 15;
          if (b.eatPauseTimer > 0) {
            b.eatPauseTimer -= dt;
            currentSpeed = 0;
            biteSpeed = 30;
          }

          b.group.scale.set(currentScale, currentScale, currentScale);
          const currentSize = b.baseSize * currentScale;

          const dir = new THREE.Vector3().subVectors(player.position, b.group.position);
          dir.y = 0;
          if (dir.lengthSq() > 0) {
            dir.normalize();
            b.group.rotation.y = Math.atan2(dir.x, dir.z);
          }

          const nextPos = b.group.position.clone().add(dir.multiplyScalar(currentSpeed * b.speedMultiplier * dt));

          if (currentSpeed > 0) {
            const hitBoxForObs = new THREE.Box3().setFromCenterAndSize(
              nextPos,
              new THREE.Vector3(currentSize * 1.5, currentSize * 1.5, currentSize * 1.5)
            );
            let ate = false;
            for (let j = obstacles.length - 1; j >= 0; j -= 1) {
              if (hitBoxForObs.intersectsBox(obstacles[j].box)) {
                scene.remove(obstacles[j].group);
                obstacles.splice(j, 1);
                audio.play(150, 50, 0.1, "sawtooth", 0.2);
                ate = true;
              }
            }
            if (ate) b.eatPauseTimer = 0.5;
          }
          b.group.position.copy(nextPos);

          const bite = Math.sin(gameTimer * biteSpeed) * 0.4 + 0.4;
          const ballData = b.group.userData as { topPivot: THREE.Group; bottomPivot: THREE.Group };
          ballData.topPivot.rotation.x = -bite;
          ballData.bottomPivot.rotation.x = bite;

          const hitBox = new THREE.Box3().setFromCenterAndSize(
            b.group.position,
            new THREE.Vector3(currentSize * 1.2, currentSize * 1.2, currentSize * 1.2)
          );
          if (pBoxFinal.intersectsBox(hitBox)) {
            gameOver();
          }
        }

        for (let i = 0; i < balls.length; i += 1) {
          for (let j = i + 1; j < balls.length; j += 1) {
            const b1 = balls[i].group;
            const b2 = balls[j].group;
            const dist = b1.position.distanceTo(b2.position);
            const s1 = balls[i].baseSize * b1.scale.x;
            const s2 = balls[j].baseSize * b2.scale.x;
            const minDist = s1 + s2;
            if (dist < minDist && dist > 0) {
              const push = new THREE.Vector3()
                .subVectors(b1.position, b2.position)
                .normalize()
                .multiplyScalar((minDist - dist) * 0.5);
              push.y = 0;
              b1.position.add(push);
              b2.position.sub(push);
            }
          }
        }

        const targetCamPos = player.position.clone().add(camOffset);
        camera.position.lerp(targetCamPos, 0.1);
      }

      renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      const aspect = getAspect();
      camera.left = -viewSize * aspect;
      camera.right = viewSize * aspect;
      camera.top = viewSize;
      camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      startGameRef.current = () => {};
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      joyZone?.removeEventListener("pointerdown", handlePointerDown);
      joyZone?.removeEventListener("pointermove", handlePointerMove);
      joyZone?.removeEventListener("pointerup", releaseJoystick);
      joyZone?.removeEventListener("pointercancel", releaseJoystick);
      if (flashTimer) window.clearTimeout(flashTimer);
      disposeScene(scene);
      floorTex.dispose();
      renderer.dispose();
    };
  }, []);

  const startGame = useCallback((track: RankingTrack | null = null) => {
    startGameRef.current(track);
  }, []);

  const retryLabel =
    gameStatus === "gameover" && selectedBgm?.spotifyEmbedUrl && !spotifyPlayerReady
      ? "BGM準備中..."
      : gameStatus === "gameover" && selectedBgm?.spotifyEmbedUrl
      ? "この曲を流しながらリプレイ"
      : "もう一度";

  const rankingDateLabel = useMemo(() => formatDate(rankingDate), [rankingDate]);
  const activeSpotifyUrl =
    gameStatus === "playing" ? (nowPlayingTrack?.spotifyEmbedUrl ?? null) : null;
  const showMiniPlayer = Boolean(activeSpotifyUrl);
  const spotifyPlayerTrack =
    (gameStatus === "playing" ? nowPlayingTrack : null) ??
    (gameStatus === "gameover" ? selectedBgm : null);

  const handleSpotifyPlayReady = useCallback((play: (() => void) | null) => {
    spotifyPlayRef.current = play;
    setSpotifyPlayerReady(Boolean(play));
  }, []);

  return (
    <main className="fixed inset-0 z-[60] overflow-hidden bg-sky-300 font-mono text-white">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/svg_logo_wh.svg"
        alt="IDOL CROSSING"
        className="pointer-events-none absolute left-4 top-4 z-20 h-auto w-[132px] drop-shadow-[0_3px_0_rgba(0,0,0,0.85)] sm:left-5 sm:top-5 sm:w-[168px]"
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        {gameStatus === "playing" && (
          <div className="voxel-rpg-text absolute left-4 top-[74px] text-xl font-bold text-yellow-300 sm:left-5 sm:top-[96px] sm:text-2xl">
            {hudText}
          </div>
        )}

        {eventText && (
          <div
            key={eventToken}
            className="voxel-rpg-text voxel-event-pop absolute top-[18%] w-full px-4 text-center text-3xl font-bold sm:text-5xl"
          >
            {eventText}
          </div>
        )}

        <div
          id="voxel-joystick-zone"
          className={`pointer-events-auto absolute left-5 ${
            showMiniPlayer ? "bottom-28" : "bottom-5"
          } h-[150px] w-[150px] rounded-full border-2 border-cyan-300/50 bg-white/10 touch-none md:hidden ${
            gameStatus === "playing" ? "" : "hidden"
          }`}
        >
          <div
            id="voxel-joystick-knob"
            className="absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-300/80 shadow-[0_0_10px_#ff6f61]"
          />
        </div>

        {spotifyPlayerTrack?.spotifyEmbedUrl && (
          <SpotifyMiniPlayer
            key={`${spotifyPlayerTrack.rank}-${spotifyPlayerTrack.spotifyEmbedUrl}`}
            onPlayReady={handleSpotifyPlayReady}
            track={spotifyPlayerTrack}
            visible={showMiniPlayer}
          />
        )}
      </div>

      <div
        className={`absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-6 ${
          gameStatus === "ready" ? "" : "hidden"
        }`}
      >
        <div className="grid w-full max-w-5xl items-center gap-4 lg:grid-cols-[1fr_420px] lg:gap-6">
          <div className="text-center lg:text-left">
            <p className="voxel-rpg-text mb-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100 sm:mb-3 sm:text-sm">
              IDOL CROSSING GAMES
            </p>
            <h1 className="voxel-rpg-text text-5xl font-black tracking-wide sm:text-7xl">ESCAPE!!</h1>
            <button
              type="button"
              onClick={() => startGame(null)}
              className="mt-5 rounded-lg border-4 border-white bg-black/85 px-8 py-3 text-xl font-black uppercase text-white shadow-[0_4px_0_#000] transition active:translate-y-1 active:shadow-none sm:mt-8 sm:px-10 sm:py-4 sm:text-2xl"
            >
              スタート
            </button>
          </div>

          <section className="max-h-[calc(100vh-210px)] overflow-y-auto rounded-lg border border-white/20 bg-black/70 p-3 shadow-2xl backdrop-blur sm:p-4 lg:max-h-[70vh]">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.12em] text-amber-300">イマキテランキング</p>
                <h2 className="text-xl font-black text-white">TOP10</h2>
              </div>
              {rankingDateLabel && <p className="text-xs text-zinc-300">{rankingDateLabel}</p>}
            </div>

            {rankingStatus === "loading" && <p className="py-6 text-sm text-zinc-300">ランキング読み込み中...</p>}
            {rankingStatus === "error" && <p className="py-6 text-sm text-red-200">{rankingMessage}</p>}
            {rankingStatus === "idle" && rankingItems.length === 0 && (
              <p className="py-6 text-sm text-zinc-300">ランキングデータがありません。</p>
            )}
            {rankingItems.length > 0 && (
              <ol className="grid gap-2">
                {rankingItems.map((item) => (
                  <li
                    key={`${item.snapshotDate}-${item.rank}-${item.artistName}`}
                    className="grid grid-cols-[30px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/10 px-3 py-1.5 sm:grid-cols-[36px_1fr_auto] sm:py-2"
                  >
                    <span className="text-lg font-black text-amber-300">{item.rank}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{item.artistName}</p>
                      <p className="truncate text-xs text-zinc-300">♪ {item.latestTrackName ?? "最新曲"}</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-300">{formatScore(item.score)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <div
        className={`absolute inset-0 z-40 flex items-center justify-center bg-black/65 px-4 py-6 ${
          gameStatus === "gameover" || gameStatus === "clear" ? "" : "hidden"
        }`}
      >
        <div className="w-full max-w-xl rounded-lg border border-white/20 bg-black/75 p-6 text-center shadow-2xl backdrop-blur">
          <h1 className="voxel-rpg-text text-5xl font-black tracking-wide sm:text-6xl">
            {gameStatus === "clear" ? "STAGE CLEAR" : "GAME OVER"}
          </h1>
          <p className="voxel-rpg-text mt-4 text-2xl font-black text-yellow-300">
            {gameStatus === "clear" ? "ステージクリア！" : `記録: ${finalScore}秒`}
          </p>

          {gameStatus === "gameover" && selectedBgm && (
            <div className="mt-6 rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/10 p-4 text-left shadow-[0_0_18px_rgba(255,0,255,0.25)]">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">次のBGM</p>
              <TrackSummary track={selectedBgm} />
              {!selectedBgm.spotifyEmbedUrl && (
                <p className="mt-3 text-xs text-zinc-300">Spotify埋め込みURLがないため、次のリプレイはBGMなしで開始します。</p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={gameStatus === "gameover" && Boolean(selectedBgm?.spotifyEmbedUrl) && !spotifyPlayerReady}
            onClick={() => {
              window.DreamCoreSDK2?.retry?.({ reason: "retry_button" });
              const replayTrack =
                gameStatus === "gameover" && selectedBgm?.spotifyEmbedUrl ? selectedBgm : null;
              if (replayTrack) {
                spotifyPlayRef.current?.();
                window.setTimeout(() => spotifyPlayRef.current?.(), 250);
              }
              startGame(replayTrack);
            }}
            className="mt-6 w-full rounded-lg border-4 border-fuchsia-400 bg-black/85 px-6 py-4 text-lg font-black text-white shadow-[0_0_10px_#ff00ff,inset_0_0_10px_#ff00ff] transition active:translate-y-1 active:bg-fuchsia-500/20 disabled:cursor-wait disabled:border-zinc-500 disabled:text-zinc-400 disabled:shadow-none sm:text-xl"
          >
            {retryLabel}
          </button>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-20 bg-white transition-opacity duration-1000 ${
          flashActive ? "opacity-100" : "opacity-0"
        }`}
      />

      <style>{`
        .voxel-rpg-text {
          text-shadow:
            2px 2px 0 #000,
            -2px -2px 0 #000,
            2px -2px 0 #000,
            -2px 2px 0 #000,
            0 4px 0 #000;
        }
        .voxel-event-pop {
          animation: voxelPopIn 2s forwards;
        }
        @keyframes voxelPopIn {
          0% { transform: scale(0.5); opacity: 0; }
          10% { transform: scale(1.2); opacity: 1; }
          20% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </main>
  );
}
