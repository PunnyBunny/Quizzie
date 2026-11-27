import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useSection } from "../providers/QuestionProvider.tsx";
import { AssessmentHeader } from "../components/AssessmentHeader";
import { SectionInstructionBody } from "../components/SectionInstructionBody";
import { useTranslation } from "../hooks/useTranslation";

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

  return (
    <div className="flex flex-col items-center bg-gray-50 min-h-screen">
      <AssessmentHeader
        title={title}
        subtitle={section?.subtitle}
        assessmentId={id}
        sectionIndex={sectionIndex}
      />

      <main className="flex flex-col w-full max-w-3xl gap-6 p-4 sm:p-6 md:p-8">
        {section?.subtitle && (
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 mb-3 whitespace-pre-line wrap-break-word">
            {section.subtitle}
          </h1>
        )}
        <section className="flex flex-col">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 mb-3">
            {t("instruction.title")}
          </h2>
          <SectionInstructionBody instruction={section?.instruction} />
        </section>

        <section className="w-full py-4 sm:py-6 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (window.confirm(t("common.confirmExit"))) {
                navigate("/");
              }
            }}
          >
            {t("common.saveAndExit")}
          </Button>

          <Button
            variant="default"
            size="lg"
            type="button"
            onClick={() => {
              navigate(`/assessment/${id}/s/${sectionIndex}/q/0`);
            }}
          >
            {t("common.next")}
          </Button>
        </section>
      </main>
    </div>
  );
}
