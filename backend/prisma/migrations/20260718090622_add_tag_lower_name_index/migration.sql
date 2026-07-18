-- Case-insensitive uniqueness safety net for tag names within a user's scope (SDS §6.1).
-- Belt-and-suspenders alongside the application-level pre-check in tagService; guards
-- against a race between two concurrent requests creating case-variant duplicates.
CREATE UNIQUE INDEX "Tag_userId_lower_name_key" ON "Tag" ("userId", LOWER("name"));