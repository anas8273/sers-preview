CREATE TABLE `online_exams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`grade` varchar(128) NOT NULL,
	`semester` varchar(64) NOT NULL,
	`duration` varchar(64) NOT NULL,
	`themeId` varchar(64) NOT NULL,
	`fontFamily` varchar(128) NOT NULL,
	`questions` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `online_exams_id` PRIMARY KEY(`id`),
	CONSTRAINT `online_exams_token_unique` UNIQUE(`token`)
);
