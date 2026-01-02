import { useNavigate, useParams } from "react-router-dom";
import { useSection } from "../providers/QuestionProvider.tsx";

export default function AssessmentSectionInstruction() {
  const { id = "", section: sectionIndexStr = "" } = useParams<{ id: string; section: string }>();
  const sectionIndex = parseInt(sectionIndexStr, 10);
  if (isNaN(sectionIndex)) {
    throw new Error("Invalid section index");
  }

  const navigate = useNavigate();

  const { section } = useSection(sectionIndex);
  const title = section?.title ?? "Section";
  const goal = section?.goal ?? "No goal provided.";
  const instructionText =
    section?.instruction?.text ?? "No instructions provided for this section.";

  return (
    <div className="flex flex-col items-center bg-gray-50">
      {/*TODO: share header with assessment*/}
      <header className="flex flex-col gap-1 w-full items-start bg-white shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">
          Assessment ID {id} • Section {sectionIndex + 1}
        </p>
      </header>

      <main className="flex flex-col w-full max-w-3xl gap-6 p-8">
        <section className="flex flex-col">
          <h1 className="text-5xl font-semibold text-gray-800 mb-3">Goal</h1>
          <p className="text-xl text-gray-800 leading-8 whitespace-pre-line">{goal}</p>
        </section>

        <section className="flex flex-col">
          <h1 className="text-4xl font-semibold text-gray-800 mb-3">Instructions</h1>
          <div className="prose max-w-none text-gray-800">
            <p className="text-xl leading-8 whitespace-pre-line">{instructionText}</p>
          </div>
        </section>

        <section className="w-full max-w-2xl py-6 flex items-center justify-between">
          <div className="w-full flex items-center justify-between">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={() => {
                if (window.confirm("Are you sure you want to exit? Your progress will be saved.")) {
                  navigate("/");
                }
              }}
            >
              Save & Exit
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50"
              onClick={() => {
                navigate(`/assessment/${id}/s/${sectionIndex}/q/0`);
              }}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
