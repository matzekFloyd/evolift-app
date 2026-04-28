"use client";

import { Lock, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function AccountPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
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

      setUserEmail(session.user.email ?? null);
      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

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
      {accountMessage ? (
        <section className="panel p-4 text-sm text-zinc-700">{accountMessage}</section>
      ) : null}
    </main>
  );
}
