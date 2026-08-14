CREATE TABLE `online_exam_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`onlineExamId` int NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`studentId` varchar(128),
	`answers` json NOT NULL,
	`autoScore` int NOT NULL DEFAULT 0,
	`autoMaxScore` int NOT NULL DEFAULT 0,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_exam_responses_id` PRIMARY KEY(`id`)
);
