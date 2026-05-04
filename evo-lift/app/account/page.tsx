"use client";

import {
  Check,
  Eraser,
  EyeOff,
  Lock,
  Mail,
  Save,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import { toExerciseBadge } from "@/lib/exercise-badge";
import { approximateAge, validateBodyMetricsInput } from "@/lib/body-metrics";
import { ExerciseSearchSelect } from "@/app/components/exercise-search-select";
import { PageShell } from "@/app/components/page-shell";
import { SegmentedTabs } from "@/app/components/segmented-tabs";
import { SettingsSection, SettingsSectionBody } from "@/app/components/settings-section";
import { SettingsSectionHeader } from "@/app/components/settings-section-header";
import { StatusNotice } from "@/app/components/status-notice";

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
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailMessageTone, setEmailMessageTone] = useState<"error" | "success">("error");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordMessageTone, setPasswordMessageTone] = useState<"error" | "success">("error");
  const [defaultsMessage, setDefaultsMessage] = useState<string | null>(null);
  const [defaultsMessageTone, setDefaultsMessageTone] = useState<"error" | "success">("success");
  const [bodyweightKg, setBodyweightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [metricsMessage, setMetricsMessage] = useState<string | null>(null);
  const [metricsMessageTone, setMetricsMessageTone] = useState<"error" | "success">("success");
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<Set<string>>(new Set());
  const [hiddenListFilter, setHiddenListFilter] = useState("");
  const [hiddenToggleExerciseId, setHiddenToggleExerciseId] = useState<string | null>(null);
  const [hiddenMessage, setHiddenMessage] = useState<string | null>(null);
  const [hiddenMessageTone, setHiddenMessageTone] = useState<"error" | "success">("error");
  const [activeSection, setActiveSection] = useState<"security" | "profile" | "exercises">("security");

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
        setHiddenMessageTone("error");
        setHiddenMessage("Could not load exercises.");
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

      const [{ data: profile, error: profileError }, { data: hiddenRows, error: hiddenError }] =
        await Promise.all([
          supabaseBrowserClient
            .from("user_profile_metrics")
            .select("bodyweight_kg,height_cm,birth_year")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          supabaseBrowserClient
            .from("user_hidden_exercises")
            .select("exercise_id")
            .eq("user_id", session.user.id),
        ]);

      if (profileError) {
        setMetricsMessageTone("error");
        setMetricsMessage("Could not load profile.");
        setIsChecking(false);
        return;
      }
      if (hiddenError) {
        setHiddenMessageTone("error");
        setHiddenMessage("Could not load hidden exercises.");
        setIsChecking(false);
        return;
      }

      setBodyweightKg(
        profile?.bodyweight_kg == null ? "" : String(profile.bodyweight_kg),
      );
      setHeightCm(profile?.height_cm == null ? "" : String(profile.height_cm));
      setBirthYear(profile?.birth_year == null ? "" : String(profile.birth_year));

      const hiddenSet = new Set<string>();
      for (const row of hiddenRows ?? []) {
        hiddenSet.add(row.exercise_id);
      }
      setHiddenExerciseIds(hiddenSet);

      const { data: defaultsData, error: defaultsError } = await supabaseBrowserClient
        .from("user_exercise_defaults")
        .select("*")
        .eq("user_id", session.user.id);
      if (defaultsError) {
        setDefaultsMessageTone("error");
        setDefaultsMessage("Could not load exercise defaults.");
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
      setEmailMessageTone("error");
      setEmailMessage("Please enter a valid new email address.");
      return;
    }

    setIsSavingEmail(true);
    setEmailMessage(null);

    const { error } = await supabaseBrowserClient.auth.updateUser({
      email: normalized,
    });

    if (error) {
      setEmailMessageTone("error");
      setEmailMessage(error.message);
      setIsSavingEmail(false);
      return;
    }

    setEmailMessageTone("success");
    setEmailMessage(
      "Email update requested. Please check your inbox to confirm the change.",
    );
    setNewEmail("");
    setIsSavingEmail(false);
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userEmail) {
      setPasswordMessageTone("error");
      setPasswordMessage("Could not verify current user email. Please log in again.");
      return;
    }
    if (!currentPassword) {
      setPasswordMessageTone("error");
      setPasswordMessage("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessageTone("error");
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMessageTone("error");
      setPasswordMessage(
        "New password must include at least one letter and one number.",
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessageTone("error");
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage(null);

    const { error: reauthError } = await supabaseBrowserClient.auth.signInWithPassword(
      {
        email: userEmail,
        password: currentPassword,
      },
    );

    if (reauthError) {
      setPasswordMessageTone("error");
      setPasswordMessage("Current password is incorrect.");
      setIsSavingPassword(false);
      return;
    }

    const { error } = await supabaseBrowserClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordMessageTone("error");
      setPasswordMessage(error.message);
      setIsSavingPassword(false);
      return;
    }

    setPasswordMessageTone("success");
    setPasswordMessage("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setIsSavingPassword(false);
  }

  async function handleMetricsSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setMetricsMessageTone("error");
      setMetricsMessage("Please log in again to save body metrics.");
      return;
    }
    const calendarYear = new Date().getFullYear();
    const parsed = validateBodyMetricsInput(
      { bodyweightKg: bodyweightKg, heightCm: heightCm, birthYear: birthYear },
      calendarYear,
    );
    if (!parsed.ok) {
      setMetricsMessageTone("error");
      setMetricsMessage(parsed.message);
      return;
    }
    setIsSavingMetrics(true);
    setMetricsMessage(null);

    const payload = {
      bodyweight_kg: parsed.value.bodyweight_kg,
      height_cm: parsed.value.height_cm,
      birth_year: parsed.value.birth_year,
    };

    const { data: updatedRows, error: updateError } = await supabaseBrowserClient
      .from("user_profile_metrics")
      .update(payload)
      .eq("user_id", userId)
      .select("user_id");

    if (updateError) {
      setMetricsMessageTone("error");
      setMetricsMessage(`Could not save body metrics: ${updateError.message}`);
      setIsSavingMetrics(false);
      return;
    }

    if (!updatedRows?.length) {
      const { error: insertError } = await supabaseBrowserClient.from("user_profile_metrics").insert({
        user_id: userId,
        ...payload,
      });
      if (insertError) {
        setMetricsMessageTone("error");
        setMetricsMessage(`Could not save body metrics: ${insertError.message}`);
        setIsSavingMetrics(false);
        return;
      }
    }

    setMetricsMessageTone("success");
    setMetricsMessage("Body metrics saved.");
    setIsSavingMetrics(false);
  }

  async function handleHiddenToggle(exerciseId: string, hide: boolean) {
    if (!userId) {
      return;
    }
    setHiddenToggleExerciseId(exerciseId);
    if (hide) {
      const { error } = await supabaseBrowserClient.from("user_hidden_exercises").insert({
        user_id: userId,
        exercise_id: exerciseId,
      });
      if (error && error.code !== "23505") {
        setHiddenMessageTone("error");
        setHiddenMessage(`Could not hide exercise: ${error.message}`);
        setHiddenToggleExerciseId(null);
        return;
      }
      setHiddenExerciseIds((prev) => {
        const next = new Set(prev);
        next.add(exerciseId);
        return next;
      });
    } else {
      const { error } = await supabaseBrowserClient
        .from("user_hidden_exercises")
        .delete()
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId);
      if (error) {
        setHiddenMessageTone("error");
        setHiddenMessage(`Could not unhide exercise: ${error.message}`);
        setHiddenToggleExerciseId(null);
        return;
      }
      setHiddenExerciseIds((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
    }
    setHiddenToggleExerciseId(null);
  }

  async function handleDefaultsSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please log in again to save defaults.");
      return;
    }
    if (!selectedExerciseId) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please select an exercise.");
      return;
    }
    setDefaultsMessage(null);

    const parsedBaseWeight = defaultBaseWeightKg ? Number(defaultBaseWeightKg) : null;
    const parsedTargetSets = defaultTargetSets ? Number(defaultTargetSets) : null;
    const parsedTargetReps = defaultTargetReps ? Number(defaultTargetReps) : null;
    const parsedTargetWeight = defaultTargetWeightKg ? Number(defaultTargetWeightKg) : null;

    if (parsedBaseWeight !== null && (!Number.isFinite(parsedBaseWeight) || parsedBaseWeight < 0)) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please enter a valid default base weight.");
      return;
    }
    if (parsedTargetSets !== null && (!Number.isFinite(parsedTargetSets) || parsedTargetSets <= 0)) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please enter a valid default number of target working sets.");
      return;
    }
    if (parsedTargetReps !== null && (!Number.isFinite(parsedTargetReps) || parsedTargetReps <= 0)) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please enter a valid default target reps value for working sets.");
      return;
    }
    if (parsedTargetWeight !== null && (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight < 0)) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please enter a valid default target weight (kg) for working sets.");
      return;
    }

    setIsSavingDefaults(true);
    setDefaultsMessage(null);

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
      setDefaultsMessageTone("error");
      setDefaultsMessage(`Could not save exercise defaults: ${error?.message ?? "Unknown error"}`);
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
    setDefaultsMessageTone("success");
    setDefaultsMessage(`Defaults saved for ${selectedExerciseLabel}.`);
    setIsSavingDefaults(false);
  }

  async function handleClearDefaults() {
    if (!userId) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please log in again to clear defaults.");
      return;
    }
    if (!selectedExerciseId) {
      setDefaultsMessageTone("error");
      setDefaultsMessage("Please select an exercise first.");
      return;
    }
    setDefaultsMessage(null);

    setIsClearingDefaults(true);
    setDefaultsMessage(null);

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
      setDefaultsMessageTone("error");
      setDefaultsMessage(`Could not clear exercise defaults: ${error?.message ?? "Unknown error"}`);
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
    setDefaultsMessage(null);
    setIsClearingDefaults(false);
  }

  const calendarYear = new Date().getFullYear();
  const birthYearNum = birthYear.trim() === "" ? null : Number(birthYear);
  const derivedAge =
    birthYearNum != null && Number.isInteger(birthYearNum)
      ? approximateAge(birthYearNum, calendarYear)
      : null;

  const filteredExercisesForHiddenList = useMemo(() => {
    const q = hiddenListFilter.trim().toLowerCase();
    if (!q) {
      return exerciseOptions;
    }
    return exerciseOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.slug.toLowerCase().includes(q),
    );
  }, [exerciseOptions, hiddenListFilter]);

  useEffect(() => {
    setEmailMessage(null);
    setPasswordMessage(null);
    setMetricsMessage(null);
    setHiddenMessage(null);
    setDefaultsMessage(null);
  }, [activeSection]);

  if (isChecking) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <UserRound className="h-6 w-6 text-sky-700" />
        User information
      </h1>
      <SegmentedTabs
        value={activeSection}
        onChange={setActiveSection}
        className="w-full"
        options={[
          { value: "security", label: "Login", icon: <Lock className="h-3.5 w-3.5" /> },
          { value: "profile", label: "Profile", icon: <UserRound className="h-3.5 w-3.5" /> },
          { value: "exercises", label: "Exercises", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
        ]}
      />
      {activeSection === "security" ? (
        <>
      <SettingsSection>
        <SettingsSectionHeader
          title="Email"
          description="Update the email address used to sign in."
          icon={<Mail className="h-4 w-4 text-zinc-500" />}
        />
        <SettingsSectionBody>
        <label className="block text-sm font-medium">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {emailMessage ? (
              <StatusNotice
                message={emailMessage}
                tone={emailMessageTone}
                onDismiss={() => setEmailMessage(null)}
                className="sm:flex-1"
              />
            ) : (
              <div className="hidden sm:block sm:flex-1" />
            )}
            <button
              type="submit"
              disabled={isSavingEmail}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:w-40"
            >
              <Check className="h-3.5 w-3.5 text-white" />
              Change email
            </button>
          </div>
        </form>
        </SettingsSectionBody>
      </SettingsSection>
      <SettingsSection>
        <SettingsSectionHeader
          title="Change password"
          description="Choose a new password to keep your account secure."
          icon={<Lock className="h-4 w-4 text-zinc-500" />}
        />
        <SettingsSectionBody>
        <form onSubmit={handlePasswordUpdate} className="space-y-3">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {passwordMessage ? (
              <StatusNotice
                message={passwordMessage}
                tone={passwordMessageTone}
                onDismiss={() => setPasswordMessage(null)}
                className="sm:flex-1"
              />
            ) : (
              <div className="hidden sm:block sm:flex-1" />
            )}
            <button
              type="submit"
              disabled={isSavingPassword}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:w-40"
            >
              <Check className="h-3.5 w-3.5 text-white" />
              Change password
            </button>
          </div>
        </form>
        </SettingsSectionBody>
      </SettingsSection>
        </>
      ) : null}
      {activeSection === "profile" ? (
      <SettingsSection>
        <SettingsSectionHeader
          title="Body metrics"
          icon={<UserRound className="h-4 w-4 text-zinc-500" />}
        />
        <p className="mt-1 text-xs text-zinc-600">
          Optional. Enter your current bodyweight and height in kg/cm. These values are saved to your
          profile and do not change the weights you log in workouts.
        </p>
        <SettingsSectionBody>
        <form onSubmit={handleMetricsSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Bodyweight (kg)
              <input
                type="number"
                min={20}
                max={400}
                step="0.1"
                value={bodyweightKg}
                onChange={(event) => setBodyweightKg(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <label className="block text-sm font-medium">
              Height (cm)
              <input
                type="number"
                min={100}
                max={250}
                step="0.1"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <label className="block text-sm font-medium">
              Year of birth
              <input
                type="number"
                min={1900}
                max={calendarYear}
                step={1}
                value={birthYear}
                onChange={(event) => setBirthYear(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
              {derivedAge != null ? (
                <span className="mt-1 block text-xs text-zinc-500">About {derivedAge} years old</span>
              ) : null}
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {metricsMessage ? (
              <StatusNotice
                message={metricsMessage}
                tone={metricsMessageTone}
                onDismiss={() => setMetricsMessage(null)}
                className="sm:flex-1"
              />
            ) : (
              <div className="hidden sm:block sm:flex-1" />
            )}
            <button
              type="submit"
              disabled={isSavingMetrics}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:w-40"
            >
              <Save className="h-3.5 w-3.5 text-white" />
              {isSavingMetrics ? "Saving..." : "Save metrics"}
            </button>
          </div>
        </form>
        </SettingsSectionBody>
      </SettingsSection>
      ) : null}
      {activeSection === "exercises" ? (
        <>
      <SettingsSection>
        <SettingsSectionHeader
          title="Hidden exercises"
          description="Hidden exercises will not appear when you choose exercises for new workout entries. Your past workout sessions stay the same, and you can still set defaults for all exercises below."
          icon={<EyeOff className="h-4 w-4 text-zinc-500" />}
        />
        <SettingsSectionBody>
        {hiddenMessage ? (
          <StatusNotice
            message={hiddenMessage}
            tone={hiddenMessageTone}
            onDismiss={() => setHiddenMessage(null)}
            className="mt-3"
          />
        ) : null}
        <label className="mt-3 block text-sm font-medium">
          Filter list
          <input
            type="search"
            value={hiddenListFilter}
            onChange={(event) => setHiddenListFilter(event.target.value)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            placeholder="Search by name or slug"
          />
        </label>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
          {filteredExercisesForHiddenList.map((option) => {
            const isHidden = hiddenExerciseIds.has(option.id);
            const isBusy = hiddenToggleExerciseId === option.id;
            return (
              <li
                key={option.id}
                className="flex items-center justify-between gap-2 rounded-md border border-transparent bg-white px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {option.label}{" "}
                  <span className="text-zinc-500">({toExerciseBadge(option.slug)})</span>
                </span>
                <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={isHidden}
                    disabled={isBusy}
                    onChange={(event) => {
                      void handleHiddenToggle(option.id, event.target.checked);
                    }}
                  />
                  Hide
                </label>
              </li>
            );
          })}
        </ul>
        </SettingsSectionBody>
      </SettingsSection>
      <SettingsSection>
        <SettingsSectionHeader
          title="Exercise defaults"
          description="Set starting values that prefill when you add an exercise to a session. Target counts and reps apply to working sets only (not warmups)."
          icon={<SlidersHorizontal className="h-4 w-4 text-zinc-500" />}
        />
        <SettingsSectionBody>
        <form onSubmit={handleDefaultsSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium sm:col-span-2">
              Exercise
              <ExerciseSearchSelect
                required
                className="mt-1 w-full"
                options={exerciseOptions}
                value={selectedExerciseId}
                onChange={setSelectedExerciseId}
              />
            </label>
            <label className="block text-sm font-medium">
              Default base weight (kg)
              <input
                type="number"
                min={0}
                step="0.25"
                value={defaultBaseWeightKg}
                onChange={(event) => setDefaultBaseWeightKg(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 20"
              />
            </label>
          </div>
          <p className="text-xs text-zinc-600">
            Default targets apply to working sets only; warmups do not count.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Default target working sets
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
              Default target weight (kg)
              <input
                type="number"
                min={0}
                step="0.25"
                value={defaultTargetWeightKg}
                onChange={(event) => setDefaultTargetWeightKg(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 60"
              />
            </label>
            <label className="block text-sm font-medium">
              Default target reps (working sets)
              <input
                type="number"
                min={1}
                value={defaultTargetReps}
                onChange={(event) => setDefaultTargetReps(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="e.g. 8"
              />
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {defaultsMessage ? (
              <StatusNotice
                message={defaultsMessage}
                tone={defaultsMessageTone}
                onDismiss={() => setDefaultsMessage(null)}
                className="sm:flex-1"
              />
            ) : (
              <div className="hidden sm:block sm:flex-1" />
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClearDefaults}
              disabled={isClearingDefaults || !selectedExerciseId}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60 sm:w-40"
            >
              <Eraser className="h-3.5 w-3.5 text-amber-600" />
              {isClearingDefaults ? "Clearing..." : "Clear defaults"}
            </button>
            <button
              type="submit"
              disabled={isSavingDefaults}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:w-40"
            >
              <Save className="h-3.5 w-3.5 text-white" />
              {isSavingDefaults ? "Saving..." : "Save defaults"}
            </button>
            </div>
          </div>
        </form>
        </SettingsSectionBody>
      </SettingsSection>
        </>
      ) : null}
    </PageShell>
  );
}
