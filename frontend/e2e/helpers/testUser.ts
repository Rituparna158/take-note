import { randomUUID } from "node:crypto";

export type TestUser = {
  email: string;
  password: string;
};

export function createTestUser(): TestUser {
  return {
    email: `journey.${randomUUID()}@example.com`,
    password: "JourneyPassword123",
  };
}
