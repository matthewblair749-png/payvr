// Loaded before anything else (imports run in order), so DATABASE_URL and
// friends exist by the time the database client is created.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
