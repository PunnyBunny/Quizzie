import express from "express";
import { validate } from "../middleware/validation";
import { admin } from "../firebase";
import { type AssessmentResponse, assessmentsCollection, toAssessmentResponse } from "../database";
import {
  type AdminCreateUserInput,
  AdminCreateUserSchema,
  type AdminCreateUserOutput,
  type AdminGetAssessmentsOutput,
  type AdminGetUsersOutput,
  type AdminRemoveUserInput,
  AdminRemoveUserSchema,
  type AdminRemoveUserOutput,
  type AdminResetPasswordInput,
  AdminResetPasswordSchema,
  type AdminResetPasswordOutput,
  type UserRecord,
} from "../validation";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../types";
import { adminHandler } from "../middleware/admin";

export const router = express.Router();

// Enforce isAdmin claim on all routes in this file
router.use(adminHandler);

// POST /admin/get-assessments
router.post(
  "/admin/get-assessments",
  async (
    _req: FirebaseFunctionRequest<{}>,
    res: FirebaseFunctionResponse<AdminGetAssessmentsOutput>,
  ) => {
    const allAssessments = await assessmentsCollection().get();

    const assessments = allAssessments.docs.reduce((acc, doc) => {
      const assessment = toAssessmentResponse(doc);
      if (assessment) {
        acc.push(assessment);
      }
      return acc;
    }, [] as AssessmentResponse[]);

    res.status(200).json({ data: { assessments } });
  },
);

// POST /admin/get-users
router.post(
  "/admin/get-users",
  async (_req: FirebaseFunctionRequest<{}>, res: FirebaseFunctionResponse<AdminGetUsersOutput>) => {
    const listUsersResult = await admin.auth().listUsers();

    const users: UserRecord[] = listUsersResult.users.map((userRecord) => ({
      email: userRecord.email,
      isAdmin: (userRecord.customClaims?.isAdmin as boolean) ?? false,
    }));

    console.log(`Retrieved ${users.length} users`);
    res.status(200).json({ data: { users } });
  },
);

// POST /admin/create-user
router.post(
  "/admin/create-user",
  validate(AdminCreateUserSchema),
  async (
    req: FirebaseFunctionRequest<AdminCreateUserInput>,
    res: FirebaseFunctionResponse<AdminCreateUserOutput>,
  ) => {
    const { email } = req.body.data;

    const userRecord = await admin.auth().createUser({
      email,
      password: Math.random().toString(36).slice(-12),
      emailVerified: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { isAdmin: false });

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    console.log(`Created user ${userRecord.uid} with email ${email}`);
    res.status(201).json({
      data: {
        uid: userRecord.uid,
        email: userRecord.email ?? email,
        resetLink,
      },
    });
  },
);

// POST /admin/reset-password
router.post(
  "/admin/reset-password",
  validate(AdminResetPasswordSchema),
  async (
    req: FirebaseFunctionRequest<AdminResetPasswordInput>,
    res: FirebaseFunctionResponse<AdminResetPasswordOutput>,
  ) => {
    const { email } = req.body.data;

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    console.log(`Generated password reset link for ${email}`);
    res.status(200).json({
      data: {
        email,
        resetLink,
      },
    });
  },
);

// POST /admin/remove-user
router.post(
  "/admin/remove-user",
  validate(AdminRemoveUserSchema),
  async (
    req: FirebaseFunctionRequest<AdminRemoveUserInput>,
    res: FirebaseFunctionResponse<AdminRemoveUserOutput>,
  ) => {
    const { email } = req.body.data;

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(userRecord.uid);

    console.log(`Deleted user ${userRecord.uid} with email ${email}`);
    res.status(200).json({
      data: {
        email,
      },
    });
  },
);
