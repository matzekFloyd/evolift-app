export function toExerciseBadge(slug: string): string {
  if (slug === "deadlift") return "DL";
  if (slug === "romanian-deadlift") return "RDL";
  if (slug === "back-squat" || slug === "goblet-squat") return "SQ";
  if (slug === "barbell-bench-press" || slug === "close-grip-bench-press") return "BP";
  if (slug === "overhead-press" || slug === "dumbbell-seated-shoulder-press") return "OHP";
  if (slug.includes("row")) return "ROW";
  if (slug.includes("pulldown")) return "PD";
  if (slug.includes("curl")) return "CURL";
  if (slug.includes("tricep")) return "TRI";
  if (slug.includes("lunge")) return "LNG";
  if (slug.includes("hip-thrust")) return "HT";
  if (slug.includes("plank")) return "PLK";
  if (slug.includes("crunch")) return "CR";

  const compact = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return compact.slice(0, 4) || "EX";
}
