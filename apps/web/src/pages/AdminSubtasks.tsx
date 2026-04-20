import React, { useEffect, useState } from "react";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase";
import type { NormStats, SubtaskDef, QuizSection } from "../lib/scoring";
import type {
  GetSubtasksOutput,
  SaveSubtaskOutput,
} from "../../../functions/src/types/subtasks";
import type {
  SaveSubtaskInput,
  DeleteSubtaskInput,
} from "../../../functions/src/types/subtasks-inputs";
import type { GetQuestionsOutput } from "../../../functions/src/types/questions";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";

type NormGrade = "S1" | "S3" | "S5";
const NORM_GRADES: NormGrade[] = ["S1", "S3", "S5"];
const NORM_FIELDS: (keyof NormStats)[] = ["min", "max", "n", "stdDev", "mean"];

const EMPTY_NORMS: { S1: NormStats | null; S3: NormStats | null; S5: NormStats | null } = {
  S1: null,
  S3: null,
  S5: null,
};

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500";

export default function AdminSubtasks() {

  const [getSubtasks, loadingSubtasks] = useHttpsCallable<{}, GetSubtasksOutput>(
    functions,
    "api/get-subtasks",
  );
  const [saveSubtask, saving] = useHttpsCallable<SaveSubtaskInput, SaveSubtaskOutput>(
    functions,
    "api/admin/save-subtask",
  );
  const [deleteSubtask, deleting] = useHttpsCallable<DeleteSubtaskInput>(
    functions,
    "api/admin/delete-subtask",
  );
  const [getQuestions] = useHttpsCallable<void, GetQuestionsOutput>(
    functions,
    "api/get-questions",
  );

  const [subtasks, setSubtasks] = useState<SubtaskDef[]>([]);
  const [sections, setSections] = useState<QuizSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<SubtaskDef | null>(null); // null = closed, empty id = new
  const [formName, setFormName] = useState("");
  const [formQuestionIds, setFormQuestionIds] = useState<
    { sectionIndex: number; questionIndex: number }[]
  >([]);
  // Draft norm input strings (so partial typing like "3." isn't lost)
  const [normDrafts, setNormDrafts] = useState<Record<NormGrade, Record<keyof NormStats, string>>>({
    S1: { min: "", max: "", n: "", stdDev: "", mean: "" },
    S3: { min: "", max: "", n: "", stdDev: "", mean: "" },
    S5: { min: "", max: "", n: "", stdDev: "", mean: "" },
  });

  useEffect(() => {
    void Promise.all([getSubtasks({}), getQuestions()]).then(([subtasksRes, questionsRes]) => {
      if (subtasksRes?.data) setSubtasks(subtasksRes.data.subtasks);
      if (questionsRes?.data) setSections(questionsRes.data.sections);
    });
  }, [getSubtasks, getQuestions]);

  const refreshSubtasks = async () => {
    const res = await getSubtasks({});
    if (res?.data) setSubtasks(res.data.subtasks);
  };

  const openNew = () => {
    setEditing({ id: "", name: "", questionIds: [], norms: { ...EMPTY_NORMS } });
    setFormName("");
    setFormQuestionIds([]);
    setNormDrafts({
      S1: { min: "", max: "", n: "", stdDev: "", mean: "" },
      S3: { min: "", max: "", n: "", stdDev: "", mean: "" },
      S5: { min: "", max: "", n: "", stdDev: "", mean: "" },
    });
    setError(null);
  };

  const openEdit = (subtask: SubtaskDef) => {
    setEditing(subtask);
    setFormName(subtask.name);
    setFormQuestionIds([...subtask.questionIds]);
    const drafts = {} as Record<NormGrade, Record<keyof NormStats, string>>;
    for (const g of NORM_GRADES) {
      const row = subtask.norms[g];
      drafts[g] = {
        min: row?.min?.toString() ?? "",
        max: row?.max?.toString() ?? "",
        n: row?.n?.toString() ?? "",
        stdDev: row?.stdDev?.toString() ?? "",
        mean: row?.mean?.toString() ?? "",
      };
    }
    setNormDrafts(drafts);
    setError(null);
  };

  const closeModal = () => setEditing(null);

  const toggleQuestion = (sectionIndex: number, questionIndex: number) => {
    setFormQuestionIds((prev) => {
      const exists = prev.some(
        (q) => q.sectionIndex === sectionIndex && q.questionIndex === questionIndex,
      );
      if (exists) {
        return prev.filter(
          (q) => !(q.sectionIndex === sectionIndex && q.questionIndex === questionIndex),
        );
      }
      return [...prev, { sectionIndex, questionIndex }];
    });
  };

  const isQuestionSelected = (sectionIndex: number, questionIndex: number) =>
    formQuestionIds.some(
      (q) => q.sectionIndex === sectionIndex && q.questionIndex === questionIndex,
    );

  const toggleAllInSection = (sectionIndex: number, sectionLength: number) => {
    const allSelected = Array.from({ length: sectionLength }, (_, i) => i).every((qi) =>
      isQuestionSelected(sectionIndex, qi),
    );

    setFormQuestionIds((prev) => {
      const without = prev.filter((q) => q.sectionIndex !== sectionIndex);
      if (allSelected) return without;
      const all = Array.from({ length: sectionLength }, (_, i) => ({
        sectionIndex,
        questionIndex: i,
      }));
      return [...without, ...all];
    });
  };

  const handleNormDraftChange = (grade: NormGrade, field: keyof NormStats, value: string) => {
    setNormDrafts((prev) => ({
      ...prev,
      [grade]: { ...prev[grade], [field]: value },
    }));
  };

  const buildNormsFromDrafts = (): {
    S1: NormStats | null;
    S3: NormStats | null;
    S5: NormStats | null;
  } => {
    const result = {} as Record<NormGrade, NormStats | null>;
    for (const g of NORM_GRADES) {
      const d = normDrafts[g];
      const allEmpty = NORM_FIELDS.every((f) => d[f].trim() === "");
      if (allEmpty) {
        result[g] = null;
      } else {
        result[g] = {
          min: parseFloat(d.min) || 0,
          max: parseFloat(d.max) || 0,
          n: parseInt(d.n) || 0,
          stdDev: parseFloat(d.stdDev) || 0,
          mean: parseFloat(d.mean) || 0,
        };
      }
    }
    return result;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formName.trim()) {
      setError("Name is required.");
      return;
    }
    if (formQuestionIds.length === 0) {
      setError("Select at least one question.");
      return;
    }

    const norms = buildNormsFromDrafts();
    const input: SaveSubtaskInput = {
      ...(editing?.id ? { id: editing.id } : {}),
      name: formName.trim(),
      questionIds: formQuestionIds,
      norms,
    };

    try {
      await saveSubtask(input);
      closeModal();
      await refreshSubtasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subtask?")) return;
    try {
      await deleteSubtask({ id });
      await refreshSubtasks();
    } catch (err) {
      console.error("Failed to delete subtask:", err);
    }
  };

  const normConfiguredBadge = (norms: SubtaskDef["norms"], grade: NormGrade) =>
    norms[grade] ? (
      <span className="inline-block w-5 text-center text-green-600 font-medium">Y</span>
    ) : (
      <span className="inline-block w-5 text-center text-gray-300">-</span>
    );

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Subtasks & Norms"
          subtitle="Define scoring subtasks and enter normative data by grade"
          backTo="/admin"
        />

        <div className="mb-4 flex justify-end">
          <Button onClick={openNew}>New Subtask</Button>
        </div>

        {/* Subtask list */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium text-center"># Questions</th>
                <th className="px-6 py-3 font-medium text-center">S1</th>
                <th className="px-6 py-3 font-medium text-center">S3</th>
                <th className="px-6 py-3 font-medium text-center">S5</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingSubtasks && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loadingSubtasks && subtasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No subtasks defined yet.
                  </td>
                </tr>
              )}
              {subtasks.map((st) => (
                <tr key={st.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{st.name}</td>
                  <td className="px-6 py-3 text-center">{st.questionIds.length}</td>
                  <td className="px-6 py-3 text-center">{normConfiguredBadge(st.norms, "S1")}</td>
                  <td className="px-6 py-3 text-center">{normConfiguredBadge(st.norms, "S3")}</td>
                  <td className="px-6 py-3 text-center">{normConfiguredBadge(st.norms, "S5")}</td>
                  <td className="px-6 py-3 space-x-2">
                    <Button size="sm" onClick={() => openEdit(st)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={deleting}
                      onClick={() => handleDelete(st.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {editing && (
        <Modal onClose={closeModal}>
          <h2 className="text-xl font-semibold mb-4">
            {editing.id ? "Edit Subtask" : "New Subtask"}
          </h2>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={INPUT_CLASSES}
                placeholder="e.g. Vocabulary"
                required
              />
            </div>

            {/* Question picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions ({formQuestionIds.length} selected)
              </label>
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {sections.map((section, sIdx) => {
                  const allSelected = Array.from({ length: section.length }, (_, i) => i).every(
                    (qi) => isQuestionSelected(sIdx, qi),
                  );
                  const selectedCount = Array.from(
                    { length: section.length },
                    (_, i) => i,
                  ).filter((qi) => isQuestionSelected(sIdx, qi)).length;

                  return (
                    <div key={sIdx} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleAllInSection(sIdx, section.length)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {section.title}{" "}
                          <span className="text-gray-400 font-normal">
                            ({section.kind.toUpperCase()}, {section.length}q
                            {selectedCount > 0 && ` — ${selectedCount} selected`})
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 px-3 py-2">
                        {Array.from({ length: section.length }, (_, qIdx) => (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => toggleQuestion(sIdx, qIdx)}
                            className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
                              isQuestionSelected(sIdx, qIdx)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {qIdx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Norm stats grid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Normative Data (leave blank if unavailable)
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="pb-1 text-gray-500">
                      <th className="pr-2 text-left font-medium">Grade</th>
                      <th className="px-1 text-left font-medium">Min</th>
                      <th className="px-1 text-left font-medium">Max</th>
                      <th className="px-1 text-left font-medium">N</th>
                      <th className="px-1 text-left font-medium">Std Dev</th>
                      <th className="px-1 text-left font-medium">Mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NORM_GRADES.map((grade) => (
                      <tr key={grade}>
                        <td className="py-1 pr-2 font-medium text-gray-700">{grade}</td>
                        {NORM_FIELDS.map((field) => (
                          <td key={field} className="py-1 px-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={normDrafts[grade][field]}
                              onChange={(e) =>
                                handleNormDraftChange(grade, field, e.target.value)
                              }
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:border-blue-500 focus:ring-blue-500"
                              placeholder="-"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <Alert kind="error">{error}</Alert>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
