-- Full-text search vector: derived from title + bodyText (SDS §4, §6.1).
-- Maintained via a trigger (not GENERATED ALWAYS ... STORED) so Prisma's
-- Unsupported("tsvector") field sees a plain column with no generation
-- expression for `prisma migrate dev`'s drift detection to conflict with.
ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector;

CREATE TRIGGER "Note_searchVector_trigger"
  BEFORE INSERT OR UPDATE OF title, "bodyText" ON "Note"
  FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger("searchVector", 'pg_catalog.english', title, "bodyText");

-- Backfill any existing rows (none expected at this point, but safe either way).
UPDATE "Note" SET "searchVector" = to_tsvector('english', coalesce(title, '') || ' ' || coalesce("bodyText", ''));

CREATE INDEX "Note_searchVector_idx" ON "Note" USING GIN ("searchVector");
