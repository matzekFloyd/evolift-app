"use server";

import { createPublicServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { createWorkoutSession, updateWorkoutSet } from "@/server/db/workouts";

type UserSessionInput = {
  accessToken: string;
  performedOn?: string;
  notes?: string | null;
};

export async function createUserWorkoutSession(input: UserSessionInput) {
  const client = createPublicServerClient(input.accessToken);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(input.accessToken);

  if (error || !user) {
    throw new Error("Invalid user token.");
  }

  return createWorkoutSession(client, {
    userId: user.id,
    performedOn: input.performedOn,
    notes: input.notes,
  });
}

export async function updateUserWorkoutSet(input: {
  accessToken: string;
  id: string;
  reps?: number;
  weightKg?: number | null;
  isWarmup?: boolean;
  notes?: string | null;
}) {
  const client = createPublicServerClient(input.accessToken);
  return updateWorkoutSet(client, input);
}

export async function createAdminWorkoutSession(input: {
  userId: string;
  performedOn?: string;
  notes?: string | null;
}) {
  // Service role bypasses RLS: only use for trusted internal flows.
  const adminClient = createServiceRoleClient();
  return createWorkoutSession(adminClient, input);
}
