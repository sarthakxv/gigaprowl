import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { probeContacts } from "@/lib/apollo";
import { guessCompanyDomain } from "@/lib/domain";
import { rateLimit } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { company, title, domain? }. Apollo contact probe. No demo fallback.
export async function POST(req) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { company, title, domain } = await req.json().catch(() => ({}));
    if (!company || !title) return NextResponse.json({ error: "company and title required" }, { status: 400 });
    if ([company, title, domain].some((value) => value != null && String(value).length > 200)) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }
    const { allowed } = await rateLimit("test-contacts", userId, 10, 3600);
    if (!allowed) return NextResponse.json({ error: "Too many lookups. Try again later." }, { status: 429 });

    const guessedDomain = guessCompanyDomain(company);
    const job = {
      sourceId: "probe",
      title: String(title).trim(),
      company: String(company).trim(),
      companyDomain: (domain && String(domain).trim()) || guessedDomain,
    };
    const { contacts, debug } = await probeContacts(job);
    return NextResponse.json({ contacts, debug: { ...debug, guessedDomain } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
