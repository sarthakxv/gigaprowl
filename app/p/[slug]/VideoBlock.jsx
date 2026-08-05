"use client";
import { useEffect, useRef, useState } from "react";

// Shows the rendered avatar video. On "pending"/"building" it drives the stepped
// build (research → mockup+render) one call at a time so no request exceeds the
// serverless limit; on "rendering" it polls HeyGen for the finished video.
export default function VideoBlock({ slug, initialStatus, initialUrl, script }) {
  const [status, setStatus] = useState(initialStatus);
  const [url, setUrl] = useState(initialUrl);
  const buildingRef = useRef(false);

  // Advance the build state machine call-by-call until it hands off to HeyGen.
  useEffect(() => {
    if (status !== "pending" && status !== "building") return;
    if (buildingRef.current) return;
    buildingRef.current = true;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        let d;
        try {
          const r = await fetch("/api/video/build", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
          });
          d = await r.json();
        } catch {
          if (!cancelled) setStatus("script_ready");
          break;
        }
        if (d && d.status && d.status !== "building") { if (!cancelled) setStatus(d.status); break; }
        // still "building" → loop to advance the next stage
      }
      buildingRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [status, slug]);

  // Poll HeyGen while rendering.
  useEffect(() => {
    if (status !== "rendering") return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      if (tries > 130) return clearInterval(t); // ~17 min cap
      try {
        const r = await fetch(`/api/video/status?slug=${slug}`);
        const d = await r.json();
        if (d.status === "ready" && d.videoUrl) { setUrl(d.videoUrl); setStatus("ready"); clearInterval(t); }
        if (d.status === "failed") { setStatus("failed"); clearInterval(t); }
      } catch {}
    }, 8000);
    return () => clearInterval(t);
  }, [status, slug]);

  if (status === "ready" && url)
    return <video controls playsInline className="w-full rounded-xl" src={url} />;

  if (status === "pending" || status === "building")
    return (
      <div>
        <p className="text-mint mb-2 animate-pulse">Preparing your personalized video — researching the company and building your deck. This can take a minute.</p>
        <p className="text-fog text-sm italic">“{script}”</p>
      </div>
    );

  if (status === "rendering")
    return (
      <div>
        <p className="text-mint mb-2 animate-pulse">Rendering your video… this takes a couple of minutes.</p>
        <p className="text-fog text-sm italic">“{script}”</p>
      </div>
    );

  async function retry() {
    setStatus("pending");
  }

  return (
    <div>
      <p className="text-fog text-sm mb-2">
        {status === "failed" ? "Video rendering failed — script below:" : "Video script (upload a face photo in onboarding to render this as a real video):"}
      </p>
      <p className="italic text-white/90 leading-relaxed">“{script}”</p>
      {status === "failed" && (
        <button onClick={retry} className="mt-4 bg-mint text-ink text-sm font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">
          Retry render
        </button>
      )}
    </div>
  );
}
