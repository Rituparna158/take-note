import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES_IN = "15m";

export interface AccessTokenClaims {
  sub: string;
  email: string;
}

interface AuthUserInput {
  id: string;
  email: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

export function signAccessToken(user: AuthUserInput): string {
  return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.email !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Invalid access token payload");
  }

  return { sub: decoded.sub, email: decoded.email };
}
