"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    setMessage(null);

    const { error } = await supabaseBrowserClient.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.replace("/");
    setIsLoading(false);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const { error } = await supabaseBrowserClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMessage("Registration successful. Please check your email to confirm.");
    setIsLoading(false);
    setMode("login");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <section className="panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold tracking-tight">EvoLift</div>
          <div className="inline-flex rounded-lg border border-amber-200 bg-amber-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
              className={`w-24 rounded-md px-3 py-1.5 text-sm font-medium ${
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
              }}
              className={`w-24 rounded-md px-3 py-1.5 text-sm font-medium ${
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
            Email
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
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Your password"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="w-24 cursor-pointer rounded-md border border-black bg-black px-4 py-2 text-sm text-white shadow-sm hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Register"}
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="text-sm">{message}</p> : null}
    </main>
  );
}
