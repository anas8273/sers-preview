CREATE TABLE `upload_intents` (
	`id` varchar(36) NOT NULL,
	`actorUserId` int NOT NULL,
	`idempotencyKeyHash` varchar(64) NOT NULL,
	`requestFingerprint` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`declaredMimeType` varchar(128) NOT NULL,
	`expectedBytes` int NOT NULL,
	`state` enum('issued','cancelled','expired') NOT NULL DEFAULT 'issued',
	`revision` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `upload_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `upload_intent_actor_key_unique` UNIQUE(`actorUserId`,`idempotencyKeyHash`)
);
--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;