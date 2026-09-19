import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { requireUserId } from "@/lib/auth/apiSession";
import { getOpenAIClient } from "@/lib/ai/openaiClient";
import { classifyAndRespond } from "@/lib/ai/assistantRouter";

export const dynamic = "force-dynamic";

// Keep an upper bound on upload size — a few seconds of speech is a small
// file; this guards against an oversized/garbage upload reaching OpenAI.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15MB

function mimeToExtension(mime: string): string {
  const type = mime.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  return map[type] ?? "webm";
}

/**
 * Voice endpoint for the single merged AI surface: audio in, one of
 * {transaction, answer, clarify} out. Two real steps, both server-side (the
 * OpenAI key never reaches the browser):
 *   1. Transcribe the recording with OpenAI's speech-to-text
 *      ("gpt-4o-transcribe", biased to English — the app is English-only
 *      for now).
 *   2. Feed the resulting text into the EXACT SAME `classifyAndRespond`
 *      pipeline the text route (`/api/ai/assistant`) calls — there is no
 *      separate/duplicated intent or parsing logic for voice, only a
 *      different input layer ahead of the same shared pipeline.
 */
export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "VOICE_NOT_CONFIGURED", message: "Voice capture requires OPENAI_API_KEY to be configured on the server." },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!audio || !(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording is too long." }, { status: 400 });
  }

  const extension = mimeToExtension(audio.type);

  let transcript: string;
  try {
    const file = await toFile(audio, `recording.${extension}`);
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file,
      model: "gpt-4o-transcribe",
      // English-only for now — biases transcription toward English rather
      // than guessing at other languages/scripts.
      language: "en",
    });
    transcript = transcription.text.trim();
  } catch (err) {
    console.error("Voice transcription failed:", err);
    return NextResponse.json({ error: "TRANSCRIPTION_FAILED", message: "Couldn't process that recording." }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "NO_SPEECH", message: "Didn't catch that.", transcript: "" }, { status: 200 });
  }

  const result = await classifyAndRespond(session.userId, transcript);

  return NextResponse.json({ ...result, transcript });
}
