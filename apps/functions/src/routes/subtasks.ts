import express from "express";
import type {
  AdminDeleteSubtaskInput,
  OkOutput,
  AdminSaveSubtaskInput,
  AdminSaveSubtaskOutput,
  GetSubtasksOutput,
} from "@vaca/contracts";
import { validate } from "../middleware/validation";
import { FieldValue } from "../firebase";
import { subtasks as subtasksDb, toSubtaskDto } from "../types/models/subtasks";
import { AdminSaveSubtaskSchema, AdminDeleteSubtaskSchema } from "../types/zod/routes/subtasks";
import type { FirebaseFunctionRequest, FirebaseFunctionResponse } from "../utils/express";
import { adminHandler } from "../middleware/admin";
import { NotFoundError } from "../middleware/error";

export const router = express.Router();

// POST /get-subtasks (any authenticated user)
router.post(
  "/get-subtasks",
  async (_req: FirebaseFunctionRequest<void>, res: FirebaseFunctionResponse<GetSubtasksOutput>) => {
    const snapshot = await subtasksDb.collection().orderBy("createdAt").get();

    const subtasks = snapshot.docs.map(toSubtaskDto);

    res.status(200).json({ data: { subtasks } });
  },
);

// POST /admin/save-subtask (admin only)
router.post(
  "/admin/save-subtask",
  adminHandler,
  validate(AdminSaveSubtaskSchema),
  async (
    req: FirebaseFunctionRequest<AdminSaveSubtaskInput>,
    res: FirebaseFunctionResponse<AdminSaveSubtaskOutput>,
  ) => {
    const { id, name, questionIds, norms } = req.body.data;
    const now = FieldValue.serverTimestamp();

    if (id) {
      const docRef = subtasksDb.doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new NotFoundError();
      }
      await docRef.update({ name, questionIds, norms, updatedAt: now });
      res.status(200).json({ data: { id } });
    } else {
      const docRef = await subtasksDb.collection().add({
        name,
        questionIds,
        norms,
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json({ data: { id: docRef.id } });
    }
  },
);

// POST /admin/delete-subtask (admin only)
router.post(
  "/admin/delete-subtask",
  adminHandler,
  validate(AdminDeleteSubtaskSchema),
  async (
    req: FirebaseFunctionRequest<AdminDeleteSubtaskInput>,
    res: FirebaseFunctionResponse<OkOutput>,
  ) => {
    const { id } = req.body.data;

    const docRef = subtasksDb.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundError();
    }

    await docRef.delete();
    res.status(200).json({ data: { ok: true } });
  },
);
