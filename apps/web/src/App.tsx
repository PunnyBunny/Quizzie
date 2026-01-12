import { Outlet, Route, Routes, useNavigate } from "react-router-dom";
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
import useAuth from "./hooks/useAuth.tsx";

interface ProtectedRouteProps {
  isAdminRoute: boolean;
}

const ProtectedRoute = ({ isAdminRoute }: ProtectedRouteProps) => {
  const { user, loading, error, isAdmin } = useAuth();

  const navigate = useNavigate();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  // Got auth state, [user == null] means not logged in
  if (user == null) {
    navigate("/login");
    return null;
  }

  // User is logged in
  if (!isAdminRoute) return <Outlet />;

  if (!isAdmin) {
    return <div>Not authorized</div>;
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

            <Route path="/thank-you" element={<ThankYou />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
