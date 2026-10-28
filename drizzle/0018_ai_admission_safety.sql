CREATE TABLE `ai_provider_state` (
	`provider` varchar(32) NOT NULL,
	`failureCount` int NOT NULL DEFAULT 0,
	`openUntil` timestamp,
	`probeRequestId` varchar(36),
	`probeExpiresAt` timestamp,
	CONSTRAINT `ai_provider_state_provider` PRIMARY KEY(`provider`)
);
--> statement-breakpoint
CREATE TABLE `ai_request_budgets` (
	`key` varchar(96) NOT NULL,
	`windowStart` timestamp NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `ai_request_budgets_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`operation` varchar(64) NOT NULL,
	`status` enum('active','succeeded','failed','abandoned') NOT NULL,
	`provider` varchar(32) NOT NULL,
	`configuredModel` varchar(128) NOT NULL,
	`returnedModel` varchar(128),
	`promptVersion` varchar(64) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`providerInvoked` boolean NOT NULL DEFAULT false,
	`promptTokens` int,
	`completionTokens` int,
	`errorCode` varchar(32),
	CONSTRAINT `ai_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD CONSTRAINT `ai_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_budget_expiry` ON `ai_request_budgets` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `ai_request_active` ON `ai_requests` (`provider`,`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `ai_request_user` ON `ai_requests` (`userId`,`status`,`expiresAt`);