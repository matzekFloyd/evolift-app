"use client";

import { useEffect } from "react";

type SwaggerUIInstance = {
  preauthorizeApiKey: (key: string, value: string) => void;
};

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => SwaggerUIInstance;
    ui?: SwaggerUIInstance;
  }
}

function getSupabaseAccessToken(): string | null {
  try {
    const storageKeys = Object.keys(window.localStorage);
    const authKey = storageKeys.find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
    if (!authKey) {
      return null;
    }

    const raw = window.localStorage.getItem(authKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (
        "access_token" in parsed &&
        typeof parsed.access_token === "string"
      ) {
        return parsed.access_token;
      }
      if (
        "currentSession" in parsed &&
        parsed.currentSession &&
        typeof parsed.currentSession === "object" &&
        "access_token" in parsed.currentSession &&
        typeof parsed.currentSession.access_token === "string"
      ) {
        return parsed.currentSession.access_token;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export default function DocsPage() {
  useEffect(() => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(stylesheet);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      if (!window.SwaggerUIBundle) {
        return;
      }

      window.ui = window.SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        requestInterceptor: (request: { headers?: Record<string, string> }) => {
          const token = getSupabaseAccessToken();
          if (token) {
            request.headers = request.headers ?? {};
            request.headers.Authorization = `Bearer ${token}`;
          }
          return request;
        },
      });

      const token = getSupabaseAccessToken();
      if (token) {
        window.ui.preauthorizeApiKey("bearerAuth", token);
      }
    };

    document.body.appendChild(script);

    return () => {
      document.head.removeChild(stylesheet);
      document.body.removeChild(script);
      const container = document.getElementById("swagger-ui");
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-2 py-4 sm:px-4 sm:py-6">
      <div className="mb-3 rounded-md border bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:hidden">
        API docs are best used on tablet or desktop. On small screens, some
        controls may require horizontal scrolling.
      </div>
      <div id="swagger-ui" />
    </main>
  );
}
