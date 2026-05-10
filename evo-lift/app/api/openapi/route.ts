import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(request: NextRequest): string {
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const openapi = {
    openapi: "3.0.3",
    info: {
      title: "Evo Lift API",
      version: "1.0.0",
      description:
        "Browser-testable API docs for Supabase-backed endpoints.\n\nWorkout templates are not exposed under `/api/*`. They are loaded and updated from authenticated pages via Supabase client queries and Next.js server actions (`server/actions/templates.ts`).",
    },
    servers: [{ url: getBaseUrl(request) }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ExerciseTranslation: {
          type: "object",
          properties: {
            lang_code: { type: "string", enum: ["en", "de"] },
            name: { type: "string" },
          },
          required: ["lang_code", "name"],
        },
        Exercise: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            slug: { type: "string" },
            translations: {
              type: "array",
              items: { $ref: "#/components/schemas/ExerciseTranslation" },
            },
          },
          required: ["id", "slug", "translations"],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/exercises": {
        get: {
          summary: "List exercises with translations",
          parameters: [
            {
              name: "lang",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["en", "de"] },
              description: "Optional language filter.",
            },
          ],
          responses: {
            "200": {
              description: "Exercise list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Exercise" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Missing/invalid bearer token" },
          },
        },
      },
    },
  };

  return NextResponse.json(openapi);
}
