import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../core/auth/LoginPage.jsx';
import ProtectedRoute from '../core/auth/ProtectedRoute.jsx';
import PortalLayout from '../core/layouts/PortalLayout.jsx';
import NotFoundPage from '../core/pages/NotFoundPage.jsx';
import AcademicCatalogPage from '../features/AcademicCatalogPage.jsx';
import LecturerAttendancePage from '../features/LecturerAttendancePage.jsx';
import LecturerScoresPage from '../features/LecturerScoresPage.jsx';
import StudentGradesPage from '../features/StudentGradesPage.jsx';
import StudentRegistrationPage from '../features/StudentRegistrationPage.jsx';
import AdminDashboardPage from '../features/AdminDashboardPage.jsx';
import ReportsPage from '../features/ReportsPage.jsx';
import GradebooksPage from '../features/GradebooksPage.jsx';
import StudentsPage from '../features/StudentsPage.jsx';
import SubjectsCurriculaPage from '../features/SubjectsCurriculaPage.jsx';
import CourseSectionsPage from '../features/CourseSectionsPage.jsx';
import LecturerSchedulePage from '../features/LecturerSchedulePage.jsx';
import StudentSchedulePage from '../features/StudentSchedulePage.jsx';
import PublicInfoPage from '../features/PublicInfoPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/thong-tin" element={<PublicInfoPage />} />
      <Route path="/thong-tin/thong-bao/:announcementId" element={<PublicInfoPage />} />

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<PortalLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="catalogs" element={<AcademicCatalogPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="subjects" element={<SubjectsCurriculaPage />} />
          <Route path="course-sections" element={<CourseSectionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="gradebooks" element={<GradebooksPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['lecturer']} />}>
        <Route path="/lecturer" element={<PortalLayout />}>
          <Route index element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<LecturerSchedulePage />} />
          <Route path="attendance" element={<LecturerAttendancePage />} />
          <Route path="scores" element={<LecturerScoresPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<PortalLayout />}>
          <Route index element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<StudentSchedulePage />} />
          <Route path="register" element={<StudentRegistrationPage />} />
          <Route path="grades" element={<StudentGradesPage />} />
          <Route path="info" element={<PublicInfoPage embedded />} />
          <Route path="info/thong-bao/:announcementId" element={<PublicInfoPage embedded />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
