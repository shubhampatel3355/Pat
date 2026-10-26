"use client";

/** Last-resort fallback when the root layout itself fails. Renders its own document, so styles are inline. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#001233 0%,#002855 50%,#023e7d 100%)", fontFamily: "system-ui, sans-serif", color: "#1c1c1e" }}>
        <title>Something went wrong · Pat Michaels OS</title>
        <main style={{ width: "min(420px, calc(100% - 48px))", background: "rgba(244,244,244,.9)", borderRadius: 28, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 300 }}>Something went wrong</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#55555a" }}>Pat Michaels OS couldn’t load. The problem has been recorded — try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ height: 48, border: 0, borderRadius: 999, background: "#023e7d", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
