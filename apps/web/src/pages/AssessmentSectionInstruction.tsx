import { useNavigate, useParams } from "react-router-dom";
import { useSection } from "../providers/QuestionProvider.tsx";
import { AssessmentHeader } from "../components/AssessmentHeader";
import { SectionInstructionBody } from "../components/SectionInstructionBody";
import { useTranslation } from "../i18n/LanguageProvider";

export default function AssessmentSectionInstruction() {
  const { id = "", section: sectionIndexStr = "" } = useParams<{ id: string; section: string }>();
  const sectionIndex = parseInt(sectionIndexStr, 10);
  if (isNaN(sectionIndex)) {
    throw new Error("Invalid section index");
  }

  const navigate = useNavigate();
  const { t } = useTranslation();

  const { section } = useSection(sectionIndex);
  const title = section?.title ?? t("instruction.section");
  const goal = section?.goal ?? t("instruction.noGoal");

  return (
    <div className="flex flex-col items-center bg-gray-50">
      <AssessmentHeader title={title} assessmentId={id} sectionIndex={sectionIndex} />

      <main className="flex flex-col w-full max-w-3xl gap-6 p-8">
        <section className="flex flex-col">
          <h1 className="text-5xl font-semibold text-gray-800 mb-3">{t("instruction.goal")}</h1>
          <p className="text-xl text-gray-800 leading-8 whitespace-pre-line">{goal}</p>
        </section>

        <section className="flex flex-col">
          <h1 className="text-4xl font-semibold text-gray-800 mb-3">{t("instruction.title")}</h1>
          <SectionInstructionBody instruction={section?.instruction} />
        </section>

        <section className="w-full max-w-2xl py-6 flex items-center justify-between">
          <div className="w-full flex items-center justify-between">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={() => {
                if (window.confirm(t("common.confirmExit"))) {
                  navigate("/");
                }
              }}
            >
              {t("common.saveAndExit")}
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50"
              onClick={() => {
                navigate(`/assessment/${id}/s/${sectionIndex}/q/0`);
              }}
            >
              {t("common.next")}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
