import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type RiskAsset = "USDC" | "USDT" | "BTC" | "AVAX";

interface ThreeCanvasProps {
  theme?: "dark" | "light";
  onSelectCoin?: (coinType: RiskAsset) => void;
}

/** Logos a color locales (PNG). */
const COINS: Record<RiskAsset, { file: string; edge: number; bg: string }> = {
  USDC: { file: "usdc.png", edge: 0x2775ca, bg: "#2775ca" },
  USDT: { file: "usdt.png", edge: 0x50af95, bg: "#50af95" },
  BTC: { file: "btc.png", edge: 0xf7931a, bg: "#f7931a" },
  AVAX: { file: "avax.png", edge: 0xe84142, bg: "#ffffff" },
};

/**
 * Monedas 3D: animacion y composicion tomadas del template
 * (cyberfin-3d-crypto-v4), con los logos reales de RiskGuard.
 */
export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ theme = "light", onSelectCoin }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const isDark = theme === "dark";
    const base = import.meta.env.BASE_URL || "/";

    // --- TEXTURAS DE MONEDAS (PNG local sobre canvas circular) ---
    function createCoinTexture(type: RiskAsset): THREE.CanvasTexture {
      const def = COINS[type];
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(canvas);

      ctx.fillStyle = def.bg;
      ctx.beginPath();
      ctx.arc(256, 256, 256, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.arc(256, 256, 222, 0, Math.PI * 2);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(256, 256, 250, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, 512, 512);
        ctx.restore();
        texture.needsUpdate = true;
      };
      img.src = `${base}assets/coins/${def.file}`;
      return texture;
    }

    const textures: Record<RiskAsset, THREE.CanvasTexture> = {
      USDC: createCoinTexture("USDC"),
      USDT: createCoinTexture("USDT"),
      BTC: createCoinTexture("BTC"),
      AVAX: createCoinTexture("AVAX"),
    };

    // --- ESCENA ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100vw";
    renderer.domElement.style.height = "100vh";
    renderer.domElement.style.zIndex = "0";
    renderer.domElement.style.pointerEvents = "auto";
    container.appendChild(renderer.domElement);

    // --- LUCES (blanca principal + rellenos suaves para que el logo se lea) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.85 : 1.15);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.6 : 2.0);
    keyLight.position.set(-6, 8, 9);
    scene.add(keyLight);
    const cyanLight = new THREE.DirectionalLight(isDark ? 0x2c93a8 : 0x2c93a8, 0.7);
    cyanLight.position.set(-8, 10, 5);
    scene.add(cyanLight);
    const pinkLight = new THREE.DirectionalLight(isDark ? 0x83b7dc : 0x83b7dc, 0.6);
    pinkLight.position.set(8, -5, 5);
    scene.add(pinkLight);
    const pointLight = new THREE.PointLight(0xffffff, isDark ? 0.5 : 0.35, 30);
    pointLight.position.set(0, 0, 9);
    scene.add(pointLight);

    // --- PARTICULAS ---
    const particlesCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 30;
      particlePositions[i + 1] = (Math.random() - 0.5) * 30;
      particlePositions[i + 2] = (Math.random() - 0.5) * 15;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: isDark ? 0x00e5ff : 0x46afc3,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- MONEDAS (composicion y animacion del template) ---
    const coinsGroup = new THREE.Group();
    scene.add(coinsGroup);

    const coinGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.22, 64);
    const assets: RiskAsset[] = ["USDC", "USDT", "BTC", "AVAX"];

    const makeMaterials = (type: RiskAsset) => [
      new THREE.MeshStandardMaterial({ color: COINS[type].edge, metalness: 0.85, roughness: 0.2 }),
      new THREE.MeshStandardMaterial({ map: textures[type], metalness: 0.25, roughness: 0.2 }),
      new THREE.MeshStandardMaterial({ map: textures[type], metalness: 0.25, roughness: 0.2 }),
    ];

    const numCoins = 21;
    const coinsList: THREE.Mesh[] = [];
    for (let i = 0; i < numCoins; i++) {
      const type = assets[i % assets.length];
      const coin = new THREE.Mesh(coinGeometry, makeMaterials(type));
      coin.position.x = (Math.random() - 0.5) * 17;
      coin.position.y = (Math.random() - 0.5) * 20 - i * 0.35;
      coin.position.z = (Math.random() - 0.5) * 6;
      coin.rotation.x = Math.random() * Math.PI;
      coin.rotation.z = Math.random() * Math.PI;
      coin.userData = {
        type,
        rotSpeedX: (Math.random() - 0.5) * 0.015,
        rotSpeedY: (Math.random() - 0.5) * 0.02,
        initialY: coin.position.y,
        floatSpeed: 0.8 + Math.random() * 0.8,
      };
      coinsGroup.add(coin);
      coinsList.push(coin);
    }

    // --- INTERACCION ---
    let mouseX = 0;
    let mouseY = 0;
    let targetScrollY = 0;
    let currentScrollY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      targetScrollY = window.scrollY;
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      mouseCoord.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseCoord.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouseCoord, camera);
      const intersects = raycaster.intersectObjects(coinsList);
      if (intersects.length > 0 && onSelectCoin) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const coinType = clickedMesh.userData.type as RiskAsset;
        if (coinType) onSelectCoin(coinType);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    renderer.domElement.addEventListener("click", onClick);

    // --- BUCLE (igual que el template: siempre anima) ---
    const clock = new THREE.Clock();
    let animationFrameId = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      currentScrollY += (targetScrollY - currentScrollY) * 0.05;
      coinsGroup.position.y = currentScrollY * 0.008;
      coinsGroup.rotation.x += (mouseY * 0.22 - coinsGroup.rotation.x) * 0.05;
      coinsGroup.rotation.y += (mouseX * 0.22 - coinsGroup.rotation.y) * 0.05;

      particles.rotation.y = elapsedTime * 0.02;
      particles.rotation.x = elapsedTime * 0.01;

      coinsList.forEach((coin) => {
        coin.rotation.x += coin.userData.rotSpeedX;
        coin.rotation.y += coin.userData.rotSpeedY;
        coin.position.y =
          coin.userData.initialY + Math.sin(elapsedTime * coin.userData.floatSpeed + coin.position.x) * 0.25;
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
      coinGeometry.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      Object.values(textures).forEach((t) => t.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
};

export default ThreeCanvas;
