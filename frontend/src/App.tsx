import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './views/LandingPage';
import { LoginPage, RegisterPage } from './views/AuthPages';
import { DashboardPage } from './views/DashboardPage';
import { PlanningsPage } from './views/PlanningsPage';
import { PlanningEditorPage } from './views/PlanningEditorPage';
import { ProfilePage, NewPlanningPage } from './views/OtherPages';
import { ReportWorkshopPage } from './views/ReportWorkshopPage';
import { FullScreenLoader } from './components/ui';
import { ToastContainer } from './components/ui/Toast';

const PAGE_MAP: Record<string, React.FC> = {
  landing:       LandingPage,
  login:         LoginPage,
  register:      RegisterPage,
  dashboard:     DashboardPage,
  plannings:     PlanningsPage,
  editor:        PlanningEditorPage,
  report:        ReportWorkshopPage,
  profile:       ProfilePage,
  newPlanning:   NewPlanningPage,
};

const AppRouter: React.FC = () => {
  const { currentPage, isAuthenticated, isBootstrapping } = useApp();
  const publicPages = ['landing', 'login', 'register'];

  if (isBootstrapping) {
    return (
      <>
        <FullScreenLoader message="Vérification de votre session et chargement de vos données..." />
        <ToastContainer />
      </>
    );
  }

  const page = !isAuthenticated && !publicPages.includes(currentPage) ? 'landing' : currentPage;
  const Page = PAGE_MAP[page] || LandingPage;
  return (
    <>
      <Page />
      <ToastContainer />
    </>
  );
};

function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}

export default App;
