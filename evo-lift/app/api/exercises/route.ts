import { NextRequest, NextResponse } from "next/server";
import { createPublicServerClient } from "@/lib/supabase/server";
import type { LanguageCode } from "@/lib/supabase/database.types";
import { getBearerToken } from "@/server/auth/access-token";
import { listExercisesWithTranslations } from "@/server/db/exercises";

function parseLanguageCode(value: string | null): LanguageCode | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "en" || value === "de") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing bearer token for authenticated RLS query." },
        { status: 401 },
      );
    }

    const lang = parseLanguageCode(request.nextUrl.searchParams.get("lang"));
    if (request.nextUrl.searchParams.get("lang") && !lang) {
      return NextResponse.json(
        { error: "Invalid lang value. Use 'en' or 'de'." },
        { status: 400 },
      );
    }

    const client = createPublicServerClient(accessToken);
    const exercises = await listExercisesWithTranslations(client, lang);

    return NextResponse.json({ data: exercises });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
