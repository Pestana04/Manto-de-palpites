CREATE TABLE `cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` integer PRIMARY KEY NOT NULL,
	`kickoff` text NOT NULL,
	`status` text NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`league_id` integer NOT NULL,
	`league` text NOT NULL,
	`season` integer NOT NULL,
	`round_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`photo` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_hash_unique` ON `participants` (`token_hash`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`participant_id` text NOT NULL,
	`fixture_id` integer NOT NULL,
	`home` integer NOT NULL,
	`away` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`participant_id`, `fixture_id`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
