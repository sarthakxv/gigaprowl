import { getPitch } from "@/lib/db";
import VideoBlock from "./VideoBlock";
import PitchLoader from "./PitchLoader";

export const dynamic = "force-dynamic";

export default async function PitchPage({ params }) {
  const pitch = await getPitch(params.slug);
  // Not found yet? The hunt may still be generating this page. Show a loader
  // that polls and loads it in automatically, instead of erroring out.
  if (!pitch) return <PitchLoader slug={params.slug} />;
  const { content, job, profileSnapshot: prof } = pitch;

  return (
    <div className="min-h-dvh bg-ink text-white font-body">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-mint text-sm font-semibold uppercase mb-4">
          Prepared for {job.company} · {job.title}
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight text-balance mb-4">{content.headline}</h1>
        <p className="text-pretty text-fog text-lg mb-10">{content.subhead}</p>

        <div className="bg-panel border border-edge rounded-2xl p-6 mb-10">
          <p className="text-sm text-fog uppercase mb-3">Personalized video pitch</p>
          <VideoBlock slug={pitch.slug} initialStatus={pitch.videoStatus} initialUrl={pitch.videoUrl || null} script={content.videoScript} />
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {content.valueProps.map((v, i) => (
            <div key={i} className="bg-panel border border-edge rounded-2xl p-5">
              <p className="text-mint font-semibold mb-2 capitalize">{v.title}</p>
              <p className="text-pretty text-fog text-sm leading-relaxed">{v.detail}</p>
            </div>
          ))}
        </div>

        <div className="bg-panel border border-edge rounded-2xl p-6 mb-10">
          <p className="text-sm text-fog uppercase mb-3">Why {job.company}, specifically</p>
          <p className="text-pretty leading-relaxed text-white/90">{content.companyAngle}</p>
        </div>

        <div className="text-center py-8">
          <p className="text-fog mb-4 tabular-nums">{prof.name} · {prof.title} · {prof.yearsExperience} yrs</p>
          <a href={prof.email ? `mailto:${prof.email}` : "#"} className="inline-block bg-mint text-ink font-bold px-8 py-4 rounded-full hover:bg-mintdim transition">
            {content.cta}
          </a>
        </div>
        <p className="text-center text-xs text-fog/50 mt-10">Built with Gigaprowl, the smartest job hunter in the world</p>
      </div>
    </div>
  );
}
