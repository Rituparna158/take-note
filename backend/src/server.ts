import cron from "node-cron";

import { createApp } from "./app.js";
import { purgeExpiredNotes } from "./jobs/purgeNotes.js";
import { purgeExpiredVersions } from "./jobs/purgeVersions.js";
import { logger } from "./lib/logger.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const purgeCronSchedule = process.env.PURGE_CRON_SCHEDULE;
if (!purgeCronSchedule || !cron.validate(purgeCronSchedule)) {
  throw new Error(
    `PURGE_CRON_SCHEDULE is missing or not a valid cron expression: ${String(purgeCronSchedule)}`,
  );
}

cron.schedule(purgeCronSchedule, () => {
  purgeExpiredNotes().catch((error: unknown) => {
    logger.error({ error }, "Failed to purge expired notes");
  });
});

cron.schedule(purgeCronSchedule, () => {
  purgeExpiredVersions().catch((error: unknown) => {
    logger.error({ error }, "Failed to purge expired note versions");
  });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
