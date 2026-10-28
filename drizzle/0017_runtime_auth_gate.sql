CREATE TABLE `auth_oauth_attempts` (
	`stateHash` varchar(64) NOT NULL,
	`browserHash` varchar(64) NOT NULL,
	`appId` varchar(64) NOT NULL,
	`redirectUri` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	CONSTRAINT `auth_oauth_attempts_stateHash` PRIMARY KEY(`stateHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`keyHash` varchar(64) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`count` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `auth_rate_limits_keyHash` PRIMARY KEY(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`idHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`appId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `auth_sessions_idHash` PRIMARY KEY(`idHash`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_oauth_attempt_expiry` ON `auth_oauth_attempts` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `auth_rate_limit_expiry` ON `auth_rate_limits` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `auth_session_expiry` ON `auth_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `auth_session_user` ON `auth_sessions` (`userId`);