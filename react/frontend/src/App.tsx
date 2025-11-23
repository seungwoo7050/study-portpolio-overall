import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { MainLayout } from './app/layouts/MainLayout';
import { HomePage } from './app/routes/HomePage';
import { LoginPage } from './app/routes/LoginPage';
import { ProjectsPage } from './app/routes/ProjectsPage';
import { ProjectIssuesPage } from './app/routes/ProjectIssuesPage';
import { IssueDetailPage } from './app/routes/IssueDetailPage';
import { IssuesPage } from './app/routes/IssuesPage';
import { TeamsPage } from './app/routes/TeamsPage';
import { TeamDetailPage } from './app/routes/TeamDetailPage';
import { TeamWorkspacePage } from './app/routes/TeamWorkspacePage';
import { StatsDashboardPage } from './app/routes/StatsDashboardPage';
import { PopularIssuesPage } from './app/routes/PopularIssuesPage';
import { ExternalApiPage } from './app/routes/ExternalApiPage';
import { LoadingSpinner } from './shared/components/LoadingSpinner';

// Code splitting for product search feature
const ProductSearchPage = lazy(() =>
  import('./app/routes/ProductSearchPage').then((module) => ({
    default: module.ProductSearchPage,
  }))
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <MainLayout>
                  <ProjectsPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:projectId/issues"
            element={
              <RequireAuth>
                <MainLayout>
                  <ProjectIssuesPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/issues/:issueId"
            element={
              <RequireAuth>
                <MainLayout>
                  <IssueDetailPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/issues"
            element={
              <RequireAuth>
                <MainLayout>
                  <IssuesPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <MainLayout>
                  <TeamsPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/teams/:teamId"
            element={
              <RequireAuth>
                <MainLayout>
                  <TeamDetailPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/teams/:teamId/workspace"
            element={
              <RequireAuth>
                <MainLayout>
                  <TeamWorkspacePage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/stats"
            element={
              <RequireAuth>
                <MainLayout>
                  <StatsDashboardPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/popular"
            element={
              <RequireAuth>
                <MainLayout>
                  <PopularIssuesPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/external"
            element={
              <RequireAuth>
                <MainLayout>
                  <ExternalApiPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/products"
            element={
              <RequireAuth>
                <MainLayout>
                  <Suspense
                    fallback={
                      <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                      </div>
                    }
                  >
                    <ProductSearchPage />
                  </Suspense>
                </MainLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
