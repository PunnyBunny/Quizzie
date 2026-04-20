import express from "express";
import { validate } from "../middleware/validation";
import { FieldValue } from "../firebase";
import { subtasks as subtasksDb, toSubtaskDto } from "../types/models/subtasks";
import {
  type SaveSubtaskInput,
  SaveSubtaskSchema,
  type DeleteSubtaskInput,
  DeleteSubtaskSchema,
} from "../types/zod/routes/subtasks";
import {
  type GetSubtasksOutput,
  type SaveSubtaskOutput,
  type DeleteSubtaskOutput,
} from "../types/subtasks";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../utils/express";
import { adminHandler } from "../middleware/admin";
import { NotFoundError } from "../middleware/error";

export const router = express.Router();

// POST /get-subtasks (any authenticated user)
router.post(
  "/get-subtasks",
  async (
    _req: FirebaseFunctionRequest<{}>,
    res: FirebaseFunctionResponse<GetSubtasksOutput>,
  ) => {
    const snapshot = await subtasksDb.collection().orderBy("createdAt").get();

    const subtasks = snapshot.docs.map(toSubtaskDto);

    res.status(200).json({ data: { subtasks } });
  },
);

// POST /admin/save-subtask (admin only)
router.post(
  "/admin/save-subtask",
  adminHandler,
  validate(SaveSubtaskSchema),
  async (
    req: FirebaseFunctionRequest<SaveSubtaskInput>,
    res: FirebaseFunctionResponse<SaveSubtaskOutput>,
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
  validate(DeleteSubtaskSchema),
  async (
    req: FirebaseFunctionRequest<DeleteSubtaskInput>,
    res: FirebaseFunctionResponse<DeleteSubtaskOutput>,
  ) => {
    const { id } = req.body.data;

    const docRef = subtasksDb.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundError();
    }

    await docRef.delete();
    res.status(200).json({ data: { success: true } });
  },
);
