import express from "express";
import { router as assessmentRouter } from "./assessments";
import { router as submissionRouter } from "./submissions";
import { router as gradingRouter } from "./grading";
import { router as adminRouter } from "./admin";
import { router as questionsRouter } from "./questions";
import { router as subtasksRouter } from "./subtasks";

export const router = express.Router();
router.use(assessmentRouter);
router.use(submissionRouter);
router.use(gradingRouter);
router.use(adminRouter);
router.use(questionsRouter);
router.use(subtasksRouter);
