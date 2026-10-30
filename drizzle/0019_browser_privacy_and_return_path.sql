CREATE TABLE `browser_storage_keys` (
	`userId` int NOT NULL,
	`keyHex` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `browser_storage_keys_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `auth_oauth_attempts` ADD `returnTo` varchar(128) DEFAULT '/' NOT NULL;--> statement-breakpoint
ALTER TABLE `browser_storage_keys` ADD CONSTRAINT `browser_storage_keys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;