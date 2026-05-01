const BODYWEIGHT_MIN = 20;
const BODYWEIGHT_MAX = 400;
const HEIGHT_CM_MIN = 100;
const HEIGHT_CM_MAX = 250;

export type BodyMetricsFields = {
  bodyweightKg: string;
  heightCm: string;
  birthYear: string;
};

export type ParsedBodyMetrics = {
  bodyweight_kg: number | null;
  height_cm: number | null;
  birth_year: number | null;
};

export function validateBodyMetricsInput(
  fields: BodyMetricsFields,
  currentCalendarYear: number,
): { ok: true; value: ParsedBodyMetrics } | { ok: false; message: string } {
  const bwTrim = fields.bodyweightKg.trim();
  const hTrim = fields.heightCm.trim();
  const yTrim = fields.birthYear.trim();

  const bodyweight_kg = bwTrim === "" ? null : Number(bwTrim);
  const height_cm = hTrim === "" ? null : Number(hTrim);
  const birth_year = yTrim === "" ? null : Number(yTrim);

  if (bodyweight_kg !== null) {
    if (!Number.isFinite(bodyweight_kg)) {
      return { ok: false, message: "Please enter a valid bodyweight." };
    }
    if (bodyweight_kg < BODYWEIGHT_MIN || bodyweight_kg > BODYWEIGHT_MAX) {
      return {
        ok: false,
        message: `Bodyweight must be between ${BODYWEIGHT_MIN} and ${BODYWEIGHT_MAX} kg.`,
      };
    }
  }

  if (height_cm !== null) {
    if (!Number.isFinite(height_cm)) {
      return { ok: false, message: "Please enter a valid height." };
    }
    if (height_cm < HEIGHT_CM_MIN || height_cm > HEIGHT_CM_MAX) {
      return {
        ok: false,
        message: `Height must be between ${HEIGHT_CM_MIN} and ${HEIGHT_CM_MAX} cm.`,
      };
    }
  }

  if (birth_year !== null) {
    if (!Number.isInteger(birth_year)) {
      return { ok: false, message: "Please enter a valid year of birth." };
    }
    if (birth_year < 1900 || birth_year > currentCalendarYear) {
      return {
        ok: false,
        message: `Year of birth must be between 1900 and ${currentCalendarYear}.`,
      };
    }
  }

  return {
    ok: true,
    value: { bodyweight_kg, height_cm, birth_year },
  };
}

export function approximateAge(birthYear: number | null, currentCalendarYear: number): number | null {
  if (birthYear == null) {
    return null;
  }
  return currentCalendarYear - birthYear;
}
