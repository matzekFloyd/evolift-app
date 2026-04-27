import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LanguageCode } from "@/lib/supabase/database.types";

type ExerciseWithTranslations = {
  id: string;
  slug: string;
  translations: Array<{
    lang_code: LanguageCode;
    name: string;
  }>;
};

export async function listExercisesWithTranslations(
  client: SupabaseClient<Database>,
  langCode?: LanguageCode,
): Promise<ExerciseWithTranslations[]> {
  const { data: exercises, error: exercisesError } = await client
    .from("exercises")
    .select("id, slug")
    .order("slug", { ascending: true });

  if (exercisesError) {
    throw new Error(`Failed to list exercises: ${exercisesError.message}`);
  }

  let translationsQuery = client
    .from("exercise_translations")
    .select("exercise_id, lang_code, name");

  if (langCode) {
    translationsQuery = translationsQuery.eq("lang_code", langCode);
  }

  const { data: translations, error: translationsError } =
    await translationsQuery;

  if (translationsError) {
    throw new Error(
      `Failed to list exercise translations: ${translationsError.message}`,
    );
  }

  const translationMap = new Map<
    string,
    Array<{ lang_code: LanguageCode; name: string }>
  >();
  for (const translation of translations ?? []) {
    const current = translationMap.get(translation.exercise_id) ?? [];
    current.push({
      lang_code: translation.lang_code,
      name: translation.name,
    });
    translationMap.set(translation.exercise_id, current);
  }

  return (exercises ?? []).map((exercise) => ({
    id: exercise.id,
    slug: exercise.slug,
    translations: translationMap.get(exercise.id) ?? [],
  }));
}
