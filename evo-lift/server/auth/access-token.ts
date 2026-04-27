import type { NextRequest } from "next/server";

export function getBearerToken(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return undefined;
  }

  const [scheme, ...rest] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || rest.length === 0) {
    return undefined;
  }

  const token = rest.join(" ").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return undefined;
  }

  // Basic JWT shape check to fail early with clearer route-level errors.
  if (token.split(".").length !== 3) {
    return undefined;
  }

  return token;
}
