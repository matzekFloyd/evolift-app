"use client";

import { CircleCheck, Dumbbell, Lock, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isVerifiedNotice = searchParams.get("verified") === "1";

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

    async function loadSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        router.replace("/");
        return;
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <section className="panel p-4">
        {isVerifiedNotice ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Email confirmed. You can log in now.</p>
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Dumbbell className="h-5 w-5 text-amber-700" />
            EvoLift
          </div>
          <div className="inline-flex w-full rounded-lg border border-amber-200 bg-amber-50 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage(null);
                setSuccessEmail(null);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium sm:w-24 sm:flex-none ${
                mode === "login"
                  ? "bg-amber-100 text-amber-900"
                  : "text-zinc-600 hover:bg-amber-100 hover:text-amber-900"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage(null);
                setSuccessEmail(null);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium sm:w-24 sm:flex-none ${
                mode === "register"
                  ? "bg-amber-100 text-amber-900"
                  : "text-zinc-600 hover:bg-amber-100 hover:text-amber-900"
              }`}
            >
              Register
            </button>
          </div>
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
              className="w-full cursor-pointer rounded-md border border-black bg-black px-4 py-2 text-sm text-white shadow-sm hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-24"
            >
              {mode === "login" ? "Log in" : "Register"}
            </button>
          </div>
        </form>
      </section>

      {successEmail ? (
        <section className="panel p-4 text-sm">
          <h2 className="inline-flex items-center gap-1 font-medium text-amber-900">
            <CircleCheck className="h-4 w-4" />
            Check your inbox
          </h2>
          <p className="mt-1 text-zinc-700">
            We sent a confirmation link to <span className="font-medium">{successEmail}</span>.
            Confirm your email, then log in.
          </p>
        </section>
      ) : null}
    </main>
  );
}
