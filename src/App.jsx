import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import AppLayout from './components/AppLayout.jsx';

import LoginScreen from './screens/LoginScreen.jsx';
import JoinScreen from './screens/JoinScreen.jsx';
import StudentProfile from './screens/student/StudentProfile.jsx';
import StudentTreesScreen from './screens/student/StudentTreesScreen.jsx';
import CatalogScreen from './screens/student/CatalogScreen.jsx';
import StudentTreeScreen from './screens/student/StudentTreeScreen.jsx';
import StudentVideosScreen from './screens/student/StudentVideosScreen.jsx';
import MentorReviewScreen from './screens/student/MentorReviewScreen.jsx';
import TeacherProfile from './screens/student/TeacherProfile.jsx';
import MessengerScreen from './screens/MessengerScreen.jsx';
import CoachProfile from './screens/instructor/CoachProfile.jsx';
import CoachCoursesScreen from './screens/instructor/CoachCoursesScreen.jsx';
import CoachCourseScreen from './screens/instructor/CoachCourseScreen.jsx';
import AuthorTreesScreen from './screens/instructor/AuthorTreesScreen.jsx';
import ShopScreen from './screens/instructor/ShopScreen.jsx';
import TreeEditorScreen from './screens/instructor/TreeEditorScreen.jsx';
import InstructorStudentDetail from './screens/instructor/InstructorStudentDetail.jsx';
import InstructorTreeScreen from './screens/instructor/InstructorTreeScreen.jsx';
import InstructorVideosScreen from './screens/instructor/InstructorVideosScreen.jsx';

// Role guard: bounce to login if not signed in / wrong role.
function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // wait for the Supabase session to resolve before routing
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'instructor' ? '/coach' : '/app'} replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-[100dvh] bg-[#05070d] text-white">
      <AuthProvider>
        <StoreProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/join/:treeId" element={<JoinScreen />} />

            {/* Student area */}
            <Route path="/app" element={<RequireRole role="student"><AppLayout role="student" /></RequireRole>}>
              <Route index element={<StudentProfile />} />
              <Route path="trees" element={<StudentTreesScreen />} />
              <Route path="catalog" element={<CatalogScreen />} />
              <Route path="tree/:treeId" element={<StudentTreeScreen />} />
              <Route path="chat" element={<MessengerScreen role="student" />} />
              <Route path="coach/:coachId" element={<TeacherProfile />} />
              <Route path="videos" element={<StudentVideosScreen />} />
              <Route path="review" element={<MentorReviewScreen />} />
            </Route>

            {/* Author / coach area */}
            <Route path="/coach" element={<RequireRole role="instructor"><AppLayout role="instructor" /></RequireRole>}>
              <Route index element={<CoachProfile />} />
              <Route path="courses" element={<CoachCoursesScreen />} />
              <Route path="courses/:treeId" element={<CoachCourseScreen />} />
              <Route path="trees" element={<AuthorTreesScreen />} />
              <Route path="trees/:treeId/edit" element={<TreeEditorScreen />} />
              <Route path="shop" element={<ShopScreen />} />
              <Route path="students" element={<MessengerScreen role="instructor" />} />
              <Route path="students/:id" element={<InstructorStudentDetail />} />
              <Route path="students/:id/tree/:treeId" element={<InstructorTreeScreen />} />
              <Route path="chat" element={<MessengerScreen role="instructor" />} />
              <Route path="videos" element={<InstructorVideosScreen />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
        </StoreProvider>
      </AuthProvider>
    </div>
  );
}
