// Year level enum helpers (mirrors the public.year_level enum in the database).
export type YearLevel = "first_year" | "second_year" | "third_year" | "fourth_year" | "graduate";

export const YEAR_LEVELS: { value: YearLevel; label: string }[] = [
  { value: "first_year", label: "1st Year" },
  { value: "second_year", label: "2nd Year" },
  { value: "third_year", label: "3rd Year" },
  { value: "fourth_year", label: "4th Year" },
  { value: "graduate", label: "Graduate" },
];

export const yearLevelLabel = (v?: string | null) =>
  YEAR_LEVELS.find((y) => y.value === v)?.label ?? v ?? "—";
