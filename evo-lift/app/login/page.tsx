"use client";

import { CircleCheck, Dumbbell, Lock, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { PageShell } from "@/app/components/page-shell";
import { SegmentedTabs } from "@/app/components/segmented-tabs";
import {
  getExerciseMetadataCacheStatus,
  loadExerciseMetadata,
} from "@/lib/exercise-metadata-cache";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifiedNotice, setIsVerifiedNotice] = useState(false);

  async function warmExerciseMetadataCache() {
    const startedAt = performance.now();
    const cacheStatus = getExerciseMetadataCacheStatus(5 * 60 * 1000);
    try {
      await loadExerciseMetadata(supabaseBrowserClient, { ttlMs: 5 * 60 * 1000 });
      const elapsedMs = Number((performance.now() - startedAt).toFixed(1));
      console.info(`[Perf] login metadata warm-up ${cacheStatus} in ${elapsedMs}ms`);
    } catch {
      // Best-effort warm-up: login flow should not fail on cache preloading.
      const elapsedMs = Number((performance.now() - startedAt).toFixed(1));
      console.info(`[Perf] login metadata warm-up failed after ${elapsedMs}ms`);
    }
  }

  function getFriendlyAuthError(rawMessage: string): string {
    const messageLower = rawMessage.toLowerCase();
    if (
      messageLower.includes("user already registered") ||
      messageLower.includes("already been registered")
    ) {
      return "This email is already registered. Try logging in instead.";
    }
    if (messageLower.includes("invalid login credentials")) {
      return "Invalid email or password.";
    }
    return rawMessage;
  }

  function getPasswordValidationError(): string | null {
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password must include at least one letter and one number.";
    }
    if (mode === "register" && password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  }

  function getNormalizedEmail(): string {
    return email.trim().toLowerCase();
  }

  function getEmailValidationError(normalizedEmail: string): string | null {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return "Please enter a valid email address.";
    }

    return null;
  }

  useEffect(() => {
    let isMounted = true;

    const params = new URLSearchParams(window.location.search);
    setIsVerifiedNotice(params.get("verified") === "1");

    async function loadSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        void warmExerciseMetadataCache();
        router.replace("/");
        return;
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void warmExerciseMetadataCache();
        router.replace("/");
        return;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = getNormalizedEmail();
    const emailError = getEmailValidationError(normalizedEmail);
    if (emailError) {
      setMessage(emailError);
      return;
    }

    const passwordError = getPasswordValidationError();
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessEmail(null);

    const { error } = await supabaseBrowserClient.auth.signInWithPassword(
      {
        email: normalizedEmail,
        password,
      },
    );

    if (error) {
      setMessage(getFriendlyAuthError(error.message));
      setIsLoading(false);
      return;
    }

    await warmExerciseMetadataCache();
    router.replace("/");
    setIsLoading(false);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = getNormalizedEmail();
    const emailError = getEmailValidationError(normalizedEmail);
    if (emailError) {
      setMessage(emailError);
      return;
    }

    const passwordError = getPasswordValidationError();
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessEmail(null);

    const { error } = await supabaseBrowserClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });

    if (error) {
      setMessage(getFriendlyAuthError(error.message));
      setIsLoading(false);
      return;
    }

    setSuccessEmail(normalizedEmail);
    setMessage(null);
    setIsLoading(false);
    setMode("login");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <PageShell className="max-w-md gap-6 pt-6 sm:pt-8">
      <section className="panel p-4">
        {isVerifiedNotice ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Email confirmed. You can log in now.</p>
          </div>
        ) : null}
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Dumbbell className="h-5 w-5 text-sky-700" />
            EvoLift
          </div>
          <SegmentedTabs
            value={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              setMessage(null);
              setSuccessEmail(null);
            }}
            className="w-full sm:w-auto"
            buttonMinWidthClassName="sm:min-w-0"
            options={[
              { value: "login", label: "Log in" },
              { value: "register", label: "Register" },
            ]}
          />
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
          className="space-y-4"
        >
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-zinc-500" />
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-zinc-500" />
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Your password"
            />
          </label>
          {mode === "register" ? (
            <label className="block text-sm font-medium">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                Confirm password
              </span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Confirm your password"
              />
            </label>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {message ? <p className="text-sm text-red-600 sm:flex-1">{message}</p> : null}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full cursor-pointer rounded-md border border-sky-700 bg-sky-700 px-4 py-2 text-sm text-white shadow-sm hover:border-sky-600 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-24"
            >
              {mode === "login" ? "Log in" : "Register"}
            </button>
          </div>
        </form>
      </section>

      {successEmail ? (
        <section className="panel p-4 text-sm">
          <h2 className="inline-flex items-center gap-1 font-medium text-sky-900">
            <CircleCheck className="h-4 w-4" />
            Check your inbox
          </h2>
          <p className="mt-1 text-zinc-700">
            We sent a confirmation link to <span className="font-medium">{successEmail}</span>.
            Confirm your email, then log in.
          </p>
        </section>
      ) : null}
    </PageShell>
  );
}
