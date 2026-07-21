import type { APIRequestContext } from "@playwright/test";
import {
  publicShareResponseSchema,
  tagResponseSchema,
  type PublicShareResponse,
  type TagResponse,
} from "@take-note/shared";

export const API_BASE_URL: string = process.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function createTagViaApi(
  request: APIRequestContext,
  accessToken: string,
  name: string,
  color: string,
): Promise<TagResponse> {
  const response = await request.post(`${API_BASE_URL}/api/tags`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name, color },
  });
  return tagResponseSchema.parse(await response.json());
}

export function extractShareToken(shareLink: string): string {
  const token = shareLink.split("/").pop();
  if (!token) {
    throw new Error(`Could not extract a share token from "${shareLink}"`);
  }
  return token;
}

export async function fetchPublicShare(
  request: APIRequestContext,
  token: string,
): Promise<{ status: number; body: PublicShareResponse }> {
  const response = await request.get(`${API_BASE_URL}/api/share/${token}`);
  return {
    status: response.status(),
    body: publicShareResponseSchema.parse(await response.json()),
  };
}
