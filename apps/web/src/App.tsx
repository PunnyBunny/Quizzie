import { useEffect } from "react";
import { Outlet, Route, Routes, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import NewAssessment from "./pages/NewAssessment";
import ViewAssessments from "./pages/ViewAssessments";
import { type AuthStateHook, useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./lib/firebase.ts";
import DashboardLayout from "./pages/DashboardLayout.tsx";
import AssessmentSectionInstruction from "./pages/AssessmentSectionInstruction.tsx";
import { AssessmentQuestion } from "./pages/AssessmentQuestion.tsx";
import OngoingAssessments from "./pages/OngoingAssessments";
import CompletedAssessments from "./pages/CompletedAssessments";
import GradeOverview from "./pages/GradeOverview";
import GradeQuestion from "./pages/GradeQuestion";
import { QuestionProvider } from "./providers/QuestionProvider.tsx";
import { AnswerProvider } from "./providers/AnswerProvider.tsx";
import { RecordingSessionProvider } from "./providers/RecordingSessionProvider.tsx";
import ThankYou from "./pages/ThankYou.tsx";

interface ProtectedRouteProps {
  authState: AuthStateHook;
}

const ProtectedRoute = ({ authState }: ProtectedRouteProps) => {
  const [user, loading, error] = authState;
  const navigate = useNavigate();
  const authenticated = user != null;
  useEffect(() => {
    if (!loading && !authenticated) {
      navigate("/login");
    }
  }, [loading, authenticated, navigate]);

  if (error) {
    return <div className="text-red">An error occurred: {error.message}</div>;
  }
  return authenticated ? <Outlet /> : null;
};

function App() {
  const authState = useAuthState(auth);
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute authState={authState} />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Home />} />
              <Route path="view-assessments" element={<ViewAssessments />} />
              <Route path="ongoing" element={<OngoingAssessments />} />
              <Route path="completed" element={<CompletedAssessments />} />
              <Route path="/grade/:id" element={<GradeOverview />}>
                <Route path="s/:sectionId/q/:questionId" element={<GradeQuestion />} />
              </Route>
            </Route>

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

            <Route path="/thank-you" element={<ThankYou />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
