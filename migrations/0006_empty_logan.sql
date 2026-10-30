CREATE TABLE `github_profiles` (
	`login` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`stars` integer NOT NULL,
	`followers` integer NOT NULL,
	`achievements` text NOT NULL,
	`fetched_at` integer NOT NULL,
	CONSTRAINT "github_profiles_login_not_empty" CHECK(length("github_profiles"."login") > 0),
	CONSTRAINT "github_profiles_stars_non_negative" CHECK("github_profiles"."stars" >= 0),
	CONSTRAINT "github_profiles_followers_non_negative" CHECK("github_profiles"."followers" >= 0),
	CONSTRAINT "github_profiles_achievements_list" CHECK(json_valid("github_profiles"."achievements") AND json_type("github_profiles"."achievements") = 'array')
);
