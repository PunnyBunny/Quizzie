import { useNavigate, useParams } from "react-router-dom";
import ScoreModal from "../components/ScoreModal";
import { Button } from "@/components/ui/button";
import { useTranslation } from "../hooks/useTranslation";

export default function ThankYou() {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="text-center w-full max-w-sm">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6">{t("thankYou.title")}</h1>
        <div className="flex flex-col gap-3">
          {id && (
            <ScoreModal
              assessmentId={id}
              trigger={<Button className="w-full">{t("thankYou.viewScores")}</Button>}
              onGoToGrading={() => navigate(`/grade/${id}`)}
            />
          )}
          <Button variant="outline" onClick={() => navigate("/")} className="w-full">
            {t("thankYou.returnHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}
