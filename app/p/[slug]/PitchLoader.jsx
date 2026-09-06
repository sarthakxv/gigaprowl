"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shown while a pitch is still being generated. Instead of a hard "not found"
// error, we open the page and poll until the pitch is ready, then refresh.
export default function PitchLoader({ slug }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      if (tries > 90) { clearInterval(t); setGaveUp(true); return; } // ~4.5 min cap
      try {
        const r = await fetch(`/api/pitch?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const d = await r.json();
        if (d.ready) { clearInterval(t); router.refresh(); }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [slug, router]);

  return (
    <div className="min-h-dvh bg-ink text-white font-body flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {!gaveUp ? (
          <>
            <div className="size-10 border-2 border-edge border-t-mint rounded-full animate-spin mx-auto mb-6" />
            <h1 className="font-display text-2xl font-bold text-balance mb-2">Building your pitch page…</h1>
            <p className="text-pretty text-fog">Personalizing the page and video for this role. This can take a minute. It will load when it's ready.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-balance mb-2">Still working on it</h1>
            <p className="text-pretty text-fog mb-6">This pitch is taking longer than expected. Refresh in a moment, or head back to your dashboard.</p>
            <button onClick={() => router.refresh()} className="bg-mint text-ink font-bold px-6 py-3 rounded-full hover:bg-mintdim transition">
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
}
