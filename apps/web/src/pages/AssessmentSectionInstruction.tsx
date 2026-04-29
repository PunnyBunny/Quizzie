import { useNavigate, useParams } from "react-router-dom";
import { useSection } from "../providers/QuestionProvider.tsx";
import { AssessmentHeader } from "../components/AssessmentHeader";
import { SectionInstructionBody } from "../components/SectionInstructionBody";

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

  return (
    <div className="flex flex-col items-center bg-gray-50 min-h-screen">
      <AssessmentHeader title={title} assessmentId={id} sectionIndex={sectionIndex} />

      <main className="flex flex-col w-full max-w-3xl gap-6 p-4 sm:p-6 md:p-8">
        <section className="flex flex-col">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-gray-800 mb-3">
            Goal
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-800 leading-relaxed sm:leading-8 whitespace-pre-line">
            {goal}
          </p>
        </section>

        <section className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 mb-3">
            Instructions
          </h1>
          <SectionInstructionBody instruction={section?.instruction} />
        </section>

        <section className="w-full py-4 sm:py-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="px-3 sm:px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm sm:text-base whitespace-nowrap"
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
            className="px-4 sm:px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50 text-sm sm:text-base"
            onClick={() => {
              navigate(`/assessment/${id}/s/${sectionIndex}/q/0`);
            }}
          >
            Next
          </button>
        </section>
      </main>
    </div>
  );
}
