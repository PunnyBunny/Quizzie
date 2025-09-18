import { useEffect } from "react";
import { Outlet, Route, Routes, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import NewAssessment from "./pages/NewAssessment";
import { type AuthStateHook, useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./lib/firebase.ts";
import Dashboard from "./pages/Dashboard.tsx";
import AssessmentSectionInstruction from "./pages/QuizSectionInstruction";
import AssessmentQuestion from "./pages/QuizQuestion";
import OngoingAssessments from "./pages/OngoingAssessments";
import CompletedAssessments from "./pages/CompletedAssessments";
import GradeOverview from "./pages/GradeOverview";
import GradeQuestion from "./pages/GradeQuestion";

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
  }, [loading, authenticated]);

  if (error) {
    return <div className="text-red">An error occurred: {error.message}</div>;
  }
  return authenticated ? <Outlet /> : null;
};

function App() {
  const authState = useAuthState(auth);
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="max-w-5xl mx-auto p-4">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute authState={authState} />}>
            <Route element={<Dashboard />}>
              <Route index element={<Home />} />
              <Route path="ongoing" element={<OngoingAssessments />} />
              <Route path="completed" element={<CompletedAssessments />} />
              <Route path="/grade/:id" element={<GradeOverview />}>
                <Route path="s/:sectionId/q/:questionId" element={<GradeQuestion />} />
              </Route>
            </Route>

            <Route path="/new-assessment" element={<NewAssessment />} />
            <Route
              path="/assessment/:id/s/:section/instruction"
              element={<AssessmentSectionInstruction />}
            />
            <Route path="/assessment/:id/s/:section/q/:question" element={<AssessmentQuestion />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default App;
