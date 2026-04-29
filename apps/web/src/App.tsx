import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import NewAssessment from "./pages/NewAssessment";
import ViewAssessments from "./pages/ViewAssessments";
import DashboardLayout from "./pages/DashboardLayout.tsx";
import AssessmentSectionInstruction from "./pages/AssessmentSectionInstruction.tsx";
import { AssessmentQuestion } from "./pages/AssessmentQuestion.tsx";
import GradeAssessments from "./pages/GradeAssessments.tsx";
import GradeAssessment from "./pages/GradeAssessment.tsx";
import { QuestionProvider } from "./providers/QuestionProvider.tsx";
import { AnswerProvider } from "./providers/AnswerProvider.tsx";
import { RecordingSessionProvider } from "./providers/RecordingSessionProvider.tsx";
import ThankYou from "./pages/ThankYou.tsx";
import AdminHome from "./pages/AdminHome.tsx";
import AdminViewAssessments from "./pages/AdminViewAssessments.tsx";
import AdminUserManagement from "./pages/AdminUserManagement.tsx";
import AdminSubtasks from "./pages/AdminSubtasks.tsx";
import AdminQuestions from "./pages/AdminQuestions.tsx";
import useAuth from "./hooks/useAuth.tsx";
import { Alert } from "./components/Alert";
import { Button } from "./components/Button";
import { toUserMessage } from "./lib/errors";
import { useTranslation } from "./hooks/useTranslation";

interface ProtectedRouteProps {
  isAdminRoute: boolean;
}

const CenteredMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-md w-full space-y-4">{children}</div>
  </div>
);

const ProtectedRoute = ({ isAdminRoute }: ProtectedRouteProps) => {
  const { user, loading, error, isAdmin } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <CenteredMessage>
        <p className="text-gray-600 text-center">{t("common.loading")}</p>
      </CenteredMessage>
    );
  }

  if (error) {
    return (
      <CenteredMessage>
        <Alert kind="error">{toUserMessage(error, t("common.couldNotVerifySession"))}</Alert>
        <Button variant="primary" onClick={() => window.location.reload()} className="w-full">
          {t("common.retry")}
        </Button>
      </CenteredMessage>
    );
  }

  if (user == null) return <Navigate to="/login" replace />;

  if (isAdminRoute && !isAdmin) {
    return (
      <CenteredMessage>
        <Alert kind="error">{t("common.noPermission")}</Alert>
        <Button variant="secondary" onClick={() => (window.location.href = "/")} className="w-full">
          {t("common.goHome")}
        </Button>
      </CenteredMessage>
    );
  }

  return <Outlet />;
};

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute isAdminRoute={true} />}>
            <Route element={<DashboardLayout />}>
              <Route path="admin" element={<AdminHome />} />
              <Route path="admin/assessments" element={<AdminViewAssessments />} />
              <Route path="admin/grade/:id" element={<GradeAssessment />} />{" "}
              <Route path="admin/users" element={<AdminUserManagement />} />
              <Route path="admin/subtasks" element={<AdminSubtasks />} />
              <Route path="admin/questions" element={<AdminQuestions />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute isAdminRoute={false} />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Home />} />
              <Route path="view-assessments" element={<ViewAssessments />} />
              <Route path="grade-assessments" element={<GradeAssessments />} />
              <Route path="grade/:id" element={<GradeAssessment />} />
            </Route>

            {/* Providers for assessment pages */}
            <Route
              element={
                <QuestionProvider>
                  <AnswerProvider>
                    <RecordingSessionProvider>
                      <Outlet />
                    </RecordingSessionProvider>
                  </AnswerProvider>
                </QuestionProvider>
              }
            >
              <Route path="/new-assessment" element={<NewAssessment />} />
              <Route
                path="/assessment/:id/s/:section/instruction"
                element={<AssessmentSectionInstruction />}
              />
              <Route
                path="/assessment/:id/s/:section/q/:question"
                element={<AssessmentQuestion />}
              />
            </Route>

            <Route path="/thank-you/:id" element={<ThankYou />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
