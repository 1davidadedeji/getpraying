import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      // drizzle-kit `generate` doesn't require a live DB connection, but the config
      // shape expects a URL. `push`/`migrate` will still fail if it's not real.
      "postgres://postgres:postgres@localhost:5432/getpraying",
  },
});
