"use client";

import { Lock, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import { toExerciseBadge } from "@/lib/exercise-badge";

export default function AccountPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; label: string; slug: string }>>([]);
  const [defaultsByExerciseId, setDefaultsByExerciseId] = useState<
    Map<string, Database["public"]["Tables"]["user_exercise_defaults"]["Row"]>
  >(new Map());
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [defaultBaseWeightKg, setDefaultBaseWeightKg] = useState("");
  const [defaultTargetSets, setDefaultTargetSets] = useState("");
  const [defaultTargetReps, setDefaultTargetReps] = useState("");
  const [defaultTargetWeightKg, setDefaultTargetWeightKg] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [isClearingDefaults, setIsClearingDefaults] = useState(false);
  const [defaultsMessage, setDefaultsMessage] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      const { data: exercises, error: exercisesError } = await supabaseBrowserClient
        .from("exercises")
        .select("id, slug")
        .order("slug", { ascending: true });
      if (exercisesError) {
        setAccountMessage("Could not load exercises.");
        setIsChecking(false);
        return;
      }

      const { data: translations } = await supabaseBrowserClient
        .from("exercise_translations")
        .select("exercise_id, lang_code, name")
        .eq("lang_code", "en");
      const translationMap = new Map<string, string>();
      for (const row of translations ?? []) {
        translationMap.set(row.exercise_id, row.name);
      }
      const options = (exercises ?? []).map((exercise) => ({
        id: exercise.id,
        label: translationMap.get(exercise.id) ?? exercise.slug,
        slug: exercise.slug,
      }));
      setExerciseOptions(options);

      const { data: defaultsData, error: defaultsError } = await supabaseBrowserClient
        .from("user_exercise_defaults")
        .select("*")
        .eq("user_id", session.user.id);
      if (defaultsError) {
        setAccountMessage("Could not load exercise defaults.");
        setIsChecking(false);
        return;
      }
      const defaultsMap = new Map<string, Database["public"]["Tables"]["user_exercise_defaults"]["Row"]>();
      for (const row of defaultsData ?? []) {
        defaultsMap.set(row.exercise_id, row);
      }
      setDefaultsByExerciseId(defaultsMap);
      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    const selectedDefault = defaultsByExerciseId.get(selectedExerciseId);
    setDefaultBaseWeightKg(
      selectedDefault?.default_base_weight_kg == null
        ? ""
        : String(selectedDefault.default_base_weight_kg),
    );
    setDefaultTargetSets(
      selectedDefault?.default_target_sets == null ? "" : String(selectedDefault.default_target_sets),
    );
    setDefaultTargetReps(
      selectedDefault?.default_target_reps == null ? "" : String(selectedDefault.default_target_reps),
    );
    setDefaultTargetWeightKg(
      selectedDefault?.default_target_weight_kg == null
        ? ""
        : String(selectedDefault.default_target_weight_kg),
    );
  }, [defaultsByExerciseId, selectedExerciseId]);

  async function handleEmailUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalized)) {
      setAccountMessage("Please enter a valid new email address.");
      return;
    }

    setIsSavingEmail(true);
    setAccountMessage(null);

    const { error } = await supabaseBrowserClient.auth.updateUser({
      email: normalized,
    });

    if (error) {
      setAccountMessage(error.message);
      setIsSavingEmail(false);
      return;
    }

    setAccountMessage(
      "Email update requested. Please check your inbox to confirm the change.",
    );
    setNewEmail("");
    setIsSavingEmail(false);
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userEmail) {
      setAccountMessage("Could not verify current user email. Please log in again.");
      return;
    }
    if (!currentPassword) {
      setAccountMessage("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setAccountMessage("New password must be at least 8 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setAccountMessage(
        "New password must include at least one letter and one number.",
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountMessage("New password and confirmation do not match.");
      return;
    }

    setIsSavingPassword(true);
    setAccountMessage(null);

    const { error: reauthError } = await supabaseBrowserClient.auth.signInWithPassword(
      {
        email: userEmail,
        password: currentPassword,
      },
    );

    if (reauthError) {
      setAccountMessage("Current password is incorrect.");
      setIsSavingPassword(false);
      return;
    }

    const { error } = await supabaseBrowserClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setAccountMessage(error.message);
      setIsSavingPassword(false);
      return;
    }

    setAccountMessage("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setIsSavingPassword(false);
  }

  async function handleDefaultsSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setAccountMessage("Please log in again to save defaults.");
      return;
    }
    if (!selectedExerciseId) {
      setAccountMessage("Please select an exercise.");
      return;
    }
    setDefaultsMessage(null);

    const parsedBaseWeight = defaultBaseWeightKg ? Number(defaultBaseWeightKg) : null;
    const parsedTargetSets = defaultTargetSets ? Number(defaultTargetSets) : null;
    const parsedTargetReps = defaultTargetReps ? Number(defaultTargetReps) : null;
    const parsedTargetWeight = defaultTargetWeightKg ? Number(defaultTargetWeightKg) : null;

    if (parsedBaseWeight !== null && (!Number.isFinite(parsedBaseWeight) || parsedBaseWeight < 0)) {
      setAccountMessage("Please enter a valid default base weight.");
      return;
    }
    if (parsedTargetSets !== null && (!Number.isFinite(parsedTargetSets) || parsedTargetSets <= 0)) {
      setAccountMessage("Please enter a valid default target sets value.");
      return;
    }
    if (parsedTargetReps !== null && (!Number.isFinite(parsedTargetReps) || parsedTargetReps <= 0)) {
      setAccountMessage("Please enter a valid default target reps value.");
      return;
    }
    if (parsedTargetWeight !== null && (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight < 0)) {
      setAccountMessage("Please enter a valid default target weight.");
      return;
    }

    setIsSavingDefaults(true);
    setAccountMessage(null);

    const payload: Database["public"]["Tables"]["user_exercise_defaults"]["Insert"] = {
      user_id: userId,
      exercise_id: selectedExerciseId,
      default_base_weight_kg: parsedBaseWeight,
      default_target_sets: parsedTargetSets,
      default_target_reps: parsedTargetReps,
      default_target_weight_kg: parsedTargetWeight,
    };

    const { data, error } = await supabaseBrowserClient
      .from("user_exercise_defaults")
      .upsert(payload, { onConflict: "user_id,exercise_id" })
      .select("*")
      .single();

    if (error || !data) {
      setAccountMessage(`Could not save exercise defaults: ${error?.message ?? "Unknown error"}`);
      setIsSavingDefaults(false);
      return;
    }

    setDefaultsByExerciseId((prev) => {
      const next = new Map(prev);
      next.set(data.exercise_id, data);
      return next;
    });
    const selectedExerciseLabel =
      exerciseOptions.find((option) => option.id === selectedExerciseId)?.label ?? "Exercise";
    setDefaultsMessage(`Defaults saved for ${selectedExerciseLabel}.`);
    setIsSavingDefaults(false);
  }

  async function handleClearDefaults() {
    if (!userId) {
      setAccountMessage("Please log in again to clear defaults.");
      return;
    }
    if (!selectedExerciseId) {
      setAccountMessage("Please select an exercise first.");
      return;
    }
    setDefaultsMessage(null);

    setIsClearingDefaults(true);
    setAccountMessage(null);

    const payload: Database["public"]["Tables"]["user_exercise_defaults"]["Insert"] = {
      user_id: userId,
      exercise_id: selectedExerciseId,
      default_base_weight_kg: null,
      default_target_sets: null,
      default_target_reps: null,
      default_target_weight_kg: null,
    };

    const { data, error } = await supabaseBrowserClient
      .from("user_exercise_defaults")
      .upsert(payload, { onConflict: "user_id,exercise_id" })
      .select("*")
      .single();

    if (error || !data) {
      setAccountMessage(`Could not clear exercise defaults: ${error?.message ?? "Unknown error"}`);
      setIsClearingDefaults(false);
      return;
    }

    setDefaultsByExerciseId((prev) => {
      const next = new Map(prev);
      next.set(data.exercise_id, data);
      return next;
    });
    setDefaultBaseWeightKg("");
    setDefaultTargetSets("");
    setDefaultTargetReps("");
    setDefaultTargetWeightKg("");
    const selectedExerciseLabel =
      exerciseOptions.find((option) => option.id === selectedExerciseId)?.label ?? "Exercise";
    setDefaultsMessage(`Defaults cleared for ${selectedExerciseLabel}.`);
    setIsClearingDefaults(false);
  }

  if (isChecking) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <UserRound className="h-6 w-6 text-amber-700" />
        User information
      </h1>
      <section className="panel p-5 text-sm">
        <h2 className="inline-flex items-center gap-1 font-medium">
          <Mail className="h-4 w-4 text-zinc-500" />
          Email
        </h2>
        <label className="mt-3 block text-sm font-medium">
          Current email
          <input
            type="email"
            readOnly
            value={userEmail ?? "unknown user"}
            className="mt-1 w-full rounded-md border bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
          />
        </label>
        <form onSubmit={handleEmailUpdate} className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            New email
            <input
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="new-email@example.com"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingEmail}
              className="h-10 w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 sm:w-40"
            >
              Change email
            </button>
          </div>
        </form>
      </section>
      <section className="panel p-5 text-sm">
        <h2 className="inline-flex items-center gap-1 font-medium">
          <Lock className="h-4 w-4 text-zinc-500" />
          Change password
        </h2>
        <form onSubmit={handlePasswordUpdate} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            Current password
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Enter your current password"
            />
          </label>
          <label className="block text-sm font-medium">
            New password
            <input
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="At least 8 characters"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm new password
            <input
              type="password"
              required
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Repeat new password"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPassword}
              className="h-10 w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 sm:w-40"
            >
              Change password
            </button>
          </div>
        </form>
      </section>
      <section className="panel p-5 text-sm">
        <h2 className="inline-flex items-center gap-1 font-medium">
          <UserRound className="h-4 w-4 text-zinc-500" />
          Exercise defaults
        </h2>
        <form onSubmit={handleDefaultsSave} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            Exercise
            <select
              required
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Select exercise</option>
              {exerciseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({toExerciseBadge(option.slug)})
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Default base weight (kg)
              <input
                type="number"
                min={0}
                step="0.5"
                value={defaultBaseWeightKg}
                onChange={(event) => setDefaultBaseWeightKg(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 20"
              />
            </label>
            <label className="block text-sm font-medium">
              Default target sets
              <input
                type="number"
                min={1}
                value={defaultTargetSets}
                onChange={(event) => setDefaultTargetSets(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 3"
              />
            </label>
            <label className="block text-sm font-medium">
              Default target reps
              <input
                type="number"
                min={1}
                value={defaultTargetReps}
                onChange={(event) => setDefaultTargetReps(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 8"
              />
            </label>
            <label className="block text-sm font-medium">
              Default target weight (kg)
              <input
                type="number"
                min={0}
                step="0.5"
                value={defaultTargetWeightKg}
                onChange={(event) => setDefaultTargetWeightKg(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 60"
              />
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-h-5 text-xs text-zinc-600">{defaultsMessage ?? ""}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClearDefaults}
              disabled={isClearingDefaults || !selectedExerciseId}
              className="h-10 w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 sm:w-40"
            >
              {isClearingDefaults ? "Clearing..." : "Clear defaults"}
            </button>
            <button
              type="submit"
              disabled={isSavingDefaults}
              className="h-10 w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 sm:w-40"
            >
              {isSavingDefaults ? "Saving..." : "Save defaults"}
            </button>
            </div>
          </div>
        </form>
      </section>
      {accountMessage ? (
        <section className="panel p-4 text-sm text-zinc-700">{accountMessage}</section>
      ) : null}
    </main>
  );
}
