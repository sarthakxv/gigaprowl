import { NextResponse } from "next/server";
import { parseResume } from "@/lib/ai";
import { updateUserState, uid } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Strip RTF control words / groups down to plain text.
function rtfToText(rtf) {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*?[^{}]*\}/g, "")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(file) {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));

  if (ext === ".pdf") {
    // unpdf bundles a modern pdf.js. The old pdf-parse throws "Invalid PDF
    // structure" / "bad XRef entry" on many perfectly valid resumes.
    let text = "";
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text || "";
    } catch (e) {
      console.error("unpdf failed:", e.message);
    }
    // Fallback: pdf-parse (different engine, sometimes reads what unpdf misses).
    if (text.trim().length < 100) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const out = await pdfParse(buf);
        if ((out.text || "").trim().length > text.trim().length) text = out.text;
      } catch (e) {
        console.error("pdf-parse fallback failed:", e.message);
      }
    }
    return text;
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value;
  }
  if (ext === ".doc") {
    // Legacy binary Word. Mammoth can't read these; word-extractor can.
    try {
      const WordExtractor = (await import("word-extractor")).default;
      const doc = await new WordExtractor().extract(buf);
      return doc.getBody();
    } catch {
      // Last-ditch: pull the readable ASCII/Latin runs out of the binary.
      return buf.toString("latin1").replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ").replace(/\s{2,}/g, " ");
    }
  }
  if (ext === ".rtf") return rtfToText(buf.toString("utf8"));

  return buf.toString("utf8"); // txt / md / anything plain-text
}

export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("resume");
    const url = form.get("url");
    const pasted = form.get("text");

    let text = null;
    let fromFile = false;
    if (file && typeof file !== "string") {
      fromFile = true;
      text = await extractText(file);
      // A file that yields almost no text is a scanned/image PDF (no text layer)
      // or an unreadable format. Tell the user precisely what to do.
      if (!text || text.trim().length < 60) {
        return NextResponse.json(
          {
            error:
              "We couldn't read any text from that file. If it's a scanned or photo-based PDF, it has no selectable text. Re-export a text PDF from Word/Google Docs (File → Save/Download as PDF), or paste your resume text below.",
          },
          { status: 422 }
        );
      }
    } else if (url && String(url).trim()) {
      const target = String(url).trim();
      const isLinkedIn = /linkedin\.com/i.test(target);
      const junkRe = /authwall|sign in|join linkedin|captcha|access denied|please log in|challenge/i;
      const isJunk = (t) => !t || t.trim().length < 400 || junkRe.test(t);

      const fetchVia = async (u) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const r = await fetch(`https://r.jina.ai/${u}`, { signal: ctrl.signal });
          if (!r.ok) throw new Error(`fetch failed (${r.status})`);
          return await r.text();
        } finally {
          clearTimeout(timer);
        }
      };

      const candidates = [];
      if (isLinkedIn) {
        // Normalized public-profile form first. Jina has the best shot at this.
        const m = target.match(/linkedin\.com\/in\/([^/?#]+)/i);
        if (m) candidates.push(`https://www.linkedin.com/in/${m[1]}`);
      }
      candidates.push(target);

      let fetched = null;
      for (const u of candidates) {
        try {
          fetched = await fetchVia(u);
          if (!isJunk(fetched)) break;
        } catch {
          fetched = null;
        }
      }

      if (isJunk(fetched)) {
        return NextResponse.json(
          {
            error: isLinkedIn
              ? "LinkedIn blocks robots from reading profiles. Easiest fix: open your profile, hit 'More → Save to PDF', and upload that here. Or just paste your About + Experience text below."
              : "Couldn't read that link. Some sites block bots. Paste your profile text instead and we'll take it from there.",
          },
          { status: 422 }
        );
      }
      text = fetched;
    } else if (pasted && String(pasted).trim()) {
      text = String(pasted);
    } else {
      return NextResponse.json({ error: "Give us something to work with. A file, a link, or pasted text." }, { status: 400 });
    }

    if (!text || text.trim().length < 50)
      return NextResponse.json({ error: "That was a little too short. We need at least a few sentences about you." }, { status: 422 });

    const profile = await parseResume(text);

    // Parse-quality gate: refuse to build a profile from genuine junk, but don't
    // punish a real resume just because the keyword fallback missed its skills.
    const badName = !profile?.name || /^candidate$/i.test(String(profile.name).trim());
    const noSkills = !Array.isArray(profile?.skills) || profile.skills.length === 0;
    const tooShort = text.trim().length < 120;
    // Reject only when there's clearly nothing usable: too little text, or both
    // the name AND the skills came back empty.
    if (tooShort || (badName && noSkills)) {
      return NextResponse.json(
        {
          error: fromFile
            ? "We couldn't extract enough from that file. Try a text-based PDF/DOCX, or paste your resume text below."
            : "We couldn't extract enough from that. Paste a bit more detail (your About + Experience) and we'll take it from there.",
        },
        { status: 422 }
      );
    }
    // Salvage a missing name from the email local-part so we don't block on it.
    if (badName && profile.email) {
      profile.name = profile.email.split("@")[0].replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    profile.id = uid("prof");
    profile.resumeChars = text.length;
    profile.resumeExcerpt = text.slice(0, 5000);
    profile.createdAt = new Date().toISOString();

    await updateUserState(userId, (s) => { s.profile = profile; });
    return NextResponse.json({ profile });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
