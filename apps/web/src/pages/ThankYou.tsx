import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ScoreModal from "../components/ScoreModal";
import { Button } from "../components/Button";
import { useTranslation } from "../i18n/LanguageProvider";

export default function ThankYou() {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const [showScore, setShowScore] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold mb-6">{t("thankYou.title")}</h1>
        <div className="flex flex-col gap-3">
          {id && (
            <Button onClick={() => setShowScore(true)}>{t("thankYou.viewScores")}</Button>
          )}
          <Button variant="dark" onClick={() => navigate("/")}>
            {t("thankYou.returnHome")}
          </Button>
        </div>
      </div>

      {showScore && id && (
        <ScoreModal
          assessmentId={id}
          onClose={() => setShowScore(false)}
          onGoToGrading={() => navigate(`/grade/${id}`)}
        />
      )}
    </div>
  );
}
