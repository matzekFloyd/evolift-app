import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Evo Lift API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
      }
      #swagger-ui {
        max-width: 1200px;
        margin: 0 auto;
      }
      .swagger-ui .topbar {
        background-color: #ffffff;
        border-bottom: 1px solid #e2e8f0;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      function getSupabaseAccessToken() {
        try {
          const storageKeys = Object.keys(window.localStorage);
          const authKey = storageKeys.find(
            (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
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
            if (typeof parsed.access_token === "string") {
              return parsed.access_token;
            }
            if (
              parsed.currentSession &&
              typeof parsed.currentSession.access_token === "string"
            ) {
              return parsed.currentSession.access_token;
            }
          }
        } catch (_err) {
          return null;
        }

        return null;
      }

      function attachToken(ui) {
        const token = getSupabaseAccessToken();
        if (!token) {
          return;
        }
        ui.preauthorizeApiKey("bearerAuth", token);
      }

      window.ui = SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        requestInterceptor: function (request) {
          const token = getSupabaseAccessToken();
          if (token) {
            request.headers.Authorization = "Bearer " + token;
          }
          return request;
        }
      });

      attachToken(window.ui);
      window.addEventListener("storage", function () {
        attachToken(window.ui);
      });
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
