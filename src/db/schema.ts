import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Site-wide totals: page views, and how many times visitors have petted the footer cat. */
export const counters = sqliteTable(
  "counters",
  {
    name: text("name").primaryKey(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    check("counters_name_known", sql`${t.name} IN ('views', 'pets')`),
    check("counters_count_non_negative", sql`${t.count} >= 0`),
  ],
);

/** Home page content edited in /admin: one JSON document per section. A missing row means "use the default". */
export const sections = sqliteTable(
  "sections",
  {
    name: text("name").primaryKey(),
    data: text("data").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    check("sections_name_known", sql`${t.name} IN ('profile', 'projects', 'skills', 'now', 'snapshots', 'banner')`),
    check("sections_data_json", sql`json_valid(${t.data})`),
  ],
);

/** The GitHub contribution calendar, one row per day. The home page reads it; a background refresh rewrites it. */
export const contributionDays = sqliteTable(
  "contribution_days",
  {
    date: text("date").primaryKey(), // "2026-10-20"
    count: integer("count").notNull(),
    fetchedAt: integer("fetched_at").notNull(), // ms since the epoch
  },
  (t) => [
    check("contribution_days_date_iso", sql`${t.date} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`),
    check("contribution_days_count_non_negative", sql`${t.count} >= 0`),
  ],
);

/** The GitHub hover card: one row per login. The home page reads it; a background refresh rewrites it. */
export const githubProfiles = sqliteTable(
  "github_profiles",
  {
    login: text("login").primaryKey(),
    name: text("name").notNull(),
    stars: integer("stars").notNull(), // all stars on the user's own public repositories
    followers: integer("followers").notNull(),
    achievements: text("achievements").notNull(), // JSON list of { slug, name, icon, tier }
    fetchedAt: integer("fetched_at").notNull(), // ms since the epoch
  },
  (t) => [
    check("github_profiles_login_not_empty", sql`length(${t.login}) > 0`),
    check("github_profiles_stars_non_negative", sql`${t.stars} >= 0`),
    check("github_profiles_followers_non_negative", sql`${t.followers} >= 0`),
    check("github_profiles_achievements_list", sql`json_valid(${t.achievements}) AND json_type(${t.achievements}) = 'array'`),
  ],
);

/** The Duolingo hover card: one row per username. The home page reads it; a background refresh rewrites it. */
export const duolingoProfiles = sqliteTable(
  "duolingo_profiles",
  {
    username: text("username").primaryKey(),
    name: text("name").notNull(),
    streak: integer("streak").notNull(), // days in a row
    totalXp: integer("total_xp").notNull(),
    learning: text("learning"), // title of the current course, e.g. "English"; null when Duolingo names none
    fetchedAt: integer("fetched_at").notNull(), // ms since the epoch
  },
  (t) => [
    check("duolingo_profiles_username_not_empty", sql`length(${t.username}) > 0`),
    check("duolingo_profiles_streak_non_negative", sql`${t.streak} >= 0`),
    check("duolingo_profiles_total_xp_non_negative", sql`${t.totalXp} >= 0`),
  ],
);
