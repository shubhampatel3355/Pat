"use client";

import { useEffect, useState } from "react";
import { INTRO_COOKIE } from "@/lib/intro";

/**
 * Brand intro (~4.4 s), recreated from the prototype's mountIntro():
 * light line → split reveal of the logo → glow, ring, flare and specular sweep → "OPERATING SYSTEM" → fade.
 *
 * The root layout renders it only when the `pm_intro` session cookie is absent (once per browser
 * session) and marks <html data-intro="1"> so content can wait for it. prefers-reduced-motion hides it
 * in CSS. The fade-out and hide are CSS animations too, so it never blocks the page even before
 * hydration; script only adds click-to-skip and sets the cookie.
 */

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

export function LogoIntro() {
  const [phase, setPhase] = useState<"playing" | "skipped" | "gone">("playing");

  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=1; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    const done = setTimeout(() => setPhase("gone"), 4400);
    return () => clearTimeout(done);
  }, []);

  useEffect(() => {
    if (phase === "gone") {
      // Screens mounted from now on (client navigations) should not wait for the intro any more.
      document.documentElement.dataset.intro = "done";
      return;
    }
    if (phase !== "skipped") return;
    const t = setTimeout(() => setPhase("gone"), 650);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  const skip = () => {
    if (phase !== "playing") return;
    // Let the page underneath appear straight away instead of waiting for its choreographed delay.
    document.documentElement.dataset.intro = "skip";
    setPhase("skipped");
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
        animation: phase === "skipped" ? `pmcOut .6s ${E} forwards, pmHide 0s linear .6s forwards` : `pmcOut .6s ${E} 3.7s forwards, pmHide 0s linear 4.3s forwards`,
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
