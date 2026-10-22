"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Brand intro (~4.4 s), recreated from the prototype's mountIntro():
 * light line → split reveal of the logo → glow, ring, flare and specular sweep → "OPERATING SYSTEM" → fade.
 *
 * Whether it plays is decided before first paint by INTRO_BOOT_SCRIPT (sets html[data-intro="1"]):
 * once per browser session, never with prefers-reduced-motion. Click anywhere to skip.
 */

export const INTRO_STORAGE_KEY = "pm_intro_played";

export const INTRO_BOOT_SCRIPT = `try{if(!sessionStorage.getItem("${INTRO_STORAGE_KEY}")&&!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)){document.documentElement.dataset.intro="1";sessionStorage.setItem("${INTRO_STORAGE_KEY}","1")}}catch(e){}`;

const E = "cubic-bezier(.65,0,.25,1)";
const O = "cubic-bezier(.16,1,.3,1)";
const LOGO = "url('/brand/pat-michaels-logo.png')";
const W = "min(76vw,700px)";
const MASK: React.CSSProperties = {
  WebkitMaskImage: LOGO,
  maskImage: LOGO,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};
const LINE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "50%",
  height: 2,
  marginTop: -1,
  opacity: 0,
  background: "linear-gradient(90deg,transparent,#9CC3FF 20%,#fff 50%,#9CC3FF 80%,transparent)",
  boxShadow: "0 0 18px 3px rgba(120,170,255,.75)",
};

const noSubscribe = () => () => {};

export function LogoIntro() {
  // "1" = playing, "skip" = skipped, null = not this session. "ssr" while server-rendering
  // (the overlay is then hidden by CSS unless the boot script marked <html data-intro>).
  const intro = useSyncExternalStore(
    noSubscribe,
    () => document.documentElement.dataset.intro ?? null,
    () => "ssr",
  );
  const [phase, setPhase] = useState<"playing" | "fading" | "gone">("playing");

  useEffect(() => {
    if (intro !== "1" || phase !== "playing") return;
    const end = setTimeout(() => setPhase("fading"), 3700);
    return () => clearTimeout(end);
  }, [intro, phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("gone"), 650);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone" || intro === null) return null;

  const skip = () => {
    if (phase !== "playing") return;
    // Let the page underneath appear straight away instead of waiting for its choreographed delay.
    document.documentElement.dataset.intro = "skip";
    setPhase("fading");
  };

  return (
    <div
      id="pm-intro"
      title="Click to skip"
      aria-hidden="true"
      onClick={skip}
      className="pm-intro"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        overflow: "hidden",
        cursor: "pointer",
        background: "#001233",
        animation: phase === "fading" ? `pmcOut .6s ${E} forwards` : undefined,
      }}
    >
      <div style={{ position: "absolute", inset: "-10%", background: "radial-gradient(60% 55% at 50% 48%,#023E7D 0%,#002855 45%,#001233 85%)", opacity: 0, animation: `pmcBg 1s ${O} forwards` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(156,195,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(156,195,255,.05) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
          WebkitMaskImage: "radial-gradient(55% 50% at 50% 48%,#000,transparent)",
          maskImage: "radial-gradient(55% 50% at 50% 48%,#000,transparent)",
          opacity: 0,
          animation: `pmcBg 1.2s ${O} .2s forwards`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "47%",
          width: "min(120vw,1100px)",
          height: "min(56vw,480px)",
          background: "radial-gradient(50% 50% at 50% 50%,rgba(60,130,230,.55),rgba(2,62,125,.25) 45%,transparent 70%)",
          filter: "blur(20px)",
          opacity: 0,
          transform: "translate(-50%,-50%) scale(.6)",
          animation: `pmcGlow 1.6s ${O} 1s forwards`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "47%",
          width: "min(92vw,860px)",
          aspectRatio: "1",
          borderRadius: "50%",
          border: "1px solid rgba(156,195,255,.35)",
          borderTopColor: "rgba(255,255,255,.9)",
          borderBottomColor: "transparent",
          opacity: 0,
          animation: `pmcRing 1.8s ${E} 1s forwards`,
        }}
      />
      <div style={{ position: "absolute", left: "50%", top: "47%", width: W, aspectRatio: "1343/481", transform: "translate(-50%,-50%) scale(1.06)", opacity: 0.4, animation: `pmcLogo 1.2s ${O} .9s forwards` }}>
        <div style={{ position: "absolute", inset: 0, clipPath: "inset(50% -2% 50% -2%)", animation: `pmcClip 1s ${E} .9s forwards` }}>
          <div style={{ position: "absolute", inset: 0, ...MASK, filter: "blur(12px)", background: "#5FA0FF", opacity: 0.6 }} />
          <div style={{ position: "absolute", inset: 0, ...MASK, background: "linear-gradient(180deg,#FFFFFF 0%,#DCE7F7 45%,#A9C2E6 55%,#F2F6FC 100%)" }} />
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...MASK }}>
            <span
              style={{
                position: "absolute",
                top: "-30%",
                bottom: "-30%",
                width: "22%",
                left: "-40%",
                background: "linear-gradient(100deg,transparent,rgba(255,255,255,.95) 50%,transparent)",
                transform: "skewX(-18deg)",
                animation: `pmcSpec .9s ${E} 1.9s forwards`,
              }}
            />
          </div>
        </div>
        <div style={{ ...LINE, animation: `pmcUp 1s ${E} .9s forwards` }} />
        <div style={{ ...LINE, animation: `pmcDown 1s ${E} .9s forwards` }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "47%",
          width: W,
          height: 2,
          background: "linear-gradient(90deg,transparent,#9CC3FF 20%,#fff 50%,#9CC3FF 80%,transparent)",
          boxShadow: "0 0 22px 4px rgba(120,170,255,.8)",
          transform: "translate(-50%,-50%) scaleX(0)",
          animation: `pmcLine .6s ${O} .3s forwards,pmlFade .01s linear .95s forwards`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "47%",
          width: "min(60vw,560px)",
          height: 6,
          borderRadius: 999,
          background: "radial-gradient(50% 50% at 50% 50%,#fff,rgba(156,195,255,.6) 40%,transparent 70%)",
          filter: "blur(2px)",
          opacity: 0,
          animation: `pmcFlare .9s ${O} 1.8s forwards`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(47% + min(15vw,142px))",
          width: "min(30vw,240px)",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(156,195,255,.8),transparent)",
          transform: "translateX(-50%) scaleX(0)",
          animation: `pmcRule .7s ${O} 2.1s forwards`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(47% + min(15vw,142px) + 14px)",
          transform: "translateX(-50%)",
          fontSize: 12,
          fontWeight: 500,
          color: "#CFE0FA",
          whiteSpace: "nowrap",
          opacity: 0,
          animation: `pmcTag .9s ${O} 2.2s forwards`,
        }}
      >
        OPERATING SYSTEM
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 50%,transparent 50%,rgba(0,10,30,.7) 100%)", pointerEvents: "none" }} />
    </div>
  );
}
