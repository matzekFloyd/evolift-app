"use server";

import { createPublicServerClient } from "@/lib/supabase/server";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  instantiateTemplate,
  listTemplates,
  updateTemplate,
  type WorkoutTemplateListItem,
  type WorkoutTemplateWithExercises,
} from "@/server/db/templates";

type TemplateExercisePayload = {
  exerciseId: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  baseWeightKg: number | null;
  notes: string | null;
};

async function userClient(accessToken: string) {
  const client = createPublicServerClient(accessToken);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(accessToken);
  if (error || !user) {
    throw new Error("Invalid user token.");
  }
  return { client, user };
}

export async function listUserTemplates(accessToken: string): Promise<WorkoutTemplateListItem[]> {
  const { client } = await userClient(accessToken);
  return listTemplates(client);
}

export async function getUserTemplateById(
  accessToken: string,
  templateId: string,
): Promise<WorkoutTemplateWithExercises | null> {
  const { client } = await userClient(accessToken);
  return getTemplateById(client, templateId);
}

export async function createUserTemplate(input: {
  accessToken: string;
  name: string;
  notes?: string | null;
  exercises: TemplateExercisePayload[];
}): Promise<WorkoutTemplateWithExercises> {
  const { client, user } = await userClient(input.accessToken);
  return createTemplate(client, {
    userId: user.id,
    name: input.name,
    notes: input.notes,
    exercises: input.exercises,
  });
}

export async function updateUserTemplate(input: {
  accessToken: string;
  templateId: string;
  name: string;
  notes?: string | null;
  exercises: TemplateExercisePayload[];
}): Promise<WorkoutTemplateWithExercises> {
  const { client } = await userClient(input.accessToken);
  return updateTemplate(client, input.templateId, {
    name: input.name,
    notes: input.notes,
    exercises: input.exercises,
  });
}

export async function deleteUserTemplate(
  accessToken: string,
  templateId: string,
): Promise<void> {
  const { client } = await userClient(accessToken);
  return deleteTemplate(client, templateId);
}

export async function instantiateUserTemplate(input: {
  accessToken: string;
  templateId: string;
  performedOn: string;
  notes?: string | null;
}): Promise<string> {
  const { client } = await userClient(input.accessToken);
  return instantiateTemplate(client, {
    templateId: input.templateId,
    performedOn: input.performedOn,
    notes: input.notes,
  });
}
