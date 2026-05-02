import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getBackendError, setAuthToken, type BackendErrorPayload } from '../lib/api';
import { buildRoute, hasExplicitHashRoute, readCurrentRoute, type AppRoute } from '../lib/routing';
import { User, Planning, Badge, PlanStatus, PlanningSolveResult, PlanningSolutionVersion } from '../types';

const TOKEN_STORAGE_KEY = 'planify:auth-token';

interface SavePlanningInput {
  title?: string;
  status?: PlanStatus;
  currentStep?: number;
  totalSteps?: number;
  progress?: number;
  badges?: Badge[];
  data?: Record<string, any>;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  plannings: Planning[];
  badges: Badge[];
  currentPage: string;
  selectedPlanning: Planning | null;
  sidebarOpen: boolean;
  login: (email: string, password: string) => Promise<BackendErrorPayload | null>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<BackendErrorPayload | null>;
  updateProfile: (name: string, email: string) => Promise<BackendErrorPayload | null>;
  navigate: (page: string, params?: any) => void;
  setSelectedPlanning: (p: Planning | null) => void;
  setSidebarOpen: (v: boolean) => void;
  createPlanning: (title: string, badges?: Badge[]) => Promise<Planning | null>;
  updatePlanningStatus: (id: string, status: PlanStatus) => Promise<void>;
  updatePlanningStep: (id: string, step: number, data?: Record<string, any>) => Promise<void>;
  savePlanningData: (id: string, payload: SavePlanningInput) => Promise<Planning | null>;
  solvePlanning: (id: string, data?: Record<string, any>, source?: string, solver?: string, solverTimeLimitSeconds?: number) => Promise<PlanningSolveResult | null>;
  listPlanningVersions: (planningId: string) => Promise<PlanningSolutionVersion[]>;
  deletePlanningVersion: (planningId: string, versionId: string) => Promise<boolean>;
  deletePlanning: (id: string) => Promise<void>;
  createBadge: (name: string, color: string) => Promise<Badge | null>;
  deleteBadge: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  toasts: ToastItem[];
}

interface ToastItem {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'info';
}

const AppContext = createContext<AppContextType>(null!);

const readStoredToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

const persistToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRoute = readCurrentRoute();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [currentPage, setCurrentPage] = useState(initialRoute.page);
  const [selectedPlanning, setSelectedPlanning] = useState<Planning | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const userRef = useRef<User | null>(null);
  const planningsRef = useRef<Planning[]>([]);

  userRef.current = user;
  planningsRef.current = plannings;

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(item => item.id !== id)), 3500);
  }, []);

  const applyRouteState = useCallback((route: AppRoute, nextPlannings: Planning[]) => {
    setCurrentPage(route.page);
    setSelectedPlanning(route.planningId ? nextPlannings.find(planning => planning.id === route.planningId) ?? null : null);
  }, []);

  const syncSelections = useCallback((nextPlannings: Planning[]) => {
    applyRouteState(readCurrentRoute(), nextPlannings);
  }, [applyRouteState]);

  const syncRouteFromLocation = useCallback((nextPlannings?: Planning[]) => {
    applyRouteState(readCurrentRoute(), nextPlannings ?? planningsRef.current);
  }, [applyRouteState]);

  const updateLocation = useCallback((page: string, params?: { projectId?: string; planningId?: string }, replace = false) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHash = `#${buildRoute(page, params)}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    if (replace) {
      window.history.replaceState(null, '', nextUrl);
      return;
    }

    window.history.pushState(null, '', nextUrl);
  }, []);

  const clearSession = useCallback((nextPage = 'landing') => {
    persistToken(null);
    setAuthToken(null);
    setUser(null);
    setPlannings([]);
    setBadges([]);
    setSelectedPlanning(null);
    setCurrentPage(nextPage);
    updateLocation(nextPage, undefined, true);
  }, [updateLocation]);

  const handlePossibleAuthError = useCallback((error: unknown, silent = false) => {
    const backendError = getBackendError(error);
    if (backendError.code === 'AUTH_REQUIRED' || backendError.code === 'INVALID_SESSION') {
      clearSession('login');
      if (!silent) {
        toast(backendError.message, 'info');
      }
      return backendError;
    }

    return backendError;
  }, [clearSession, toast]);

  const loadAppData = useCallback(async (options?: { userOverride?: User | null }) => {
    const effectiveUser = options?.userOverride ?? userRef.current;
    if (!effectiveUser) {
      setPlannings([]);
      return;
    }

    try {
      const [planningsResponse, tagsResponse] = await Promise.all([
        api.get<{ data: { plannings: Planning[] } }>('/api/plannings'),
        api.get<{ data: { tags: Badge[] } }>('/api/tags'),
      ]);

      const nextPlannings = planningsResponse.data.data.plannings;
      setPlannings(nextPlannings);
      setBadges(tagsResponse.data.data.tags);
      syncRouteFromLocation(nextPlannings);
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
    }
  }, [handlePossibleAuthError, syncRouteFromLocation, toast]);

  const refreshData = useCallback(async () => {
    await loadAppData();
  }, [loadAppData]);

  useEffect(() => {
    const handleLocationChange = () => {
      syncRouteFromLocation();
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [syncRouteFromLocation]);

  useEffect(() => {
    const storedToken = readStoredToken();
    if (!storedToken) {
      syncRouteFromLocation();
      setIsBootstrapping(false);
      return;
    }

    setAuthToken(storedToken);

    let cancelled = false;
    void (async () => {
      try {
        const response = await api.get<{ data: { user: User } }>('/api/auth/me');
        if (cancelled) {
          return;
        }

        const nextUser = response.data.data.user;
        setUser(nextUser);
        if (!hasExplicitHashRoute()) {
          updateLocation('dashboard', undefined, true);
        }
        await loadAppData({ userOverride: nextUser });
        syncRouteFromLocation();
      } catch (error) {
        if (cancelled) {
          return;
        }

        handlePossibleAuthError(error, true);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handlePossibleAuthError, loadAppData, syncRouteFromLocation, updateLocation]);

  useEffect(() => {
    if (!user || isBootstrapping) {
      return;
    }

    const route = readCurrentRoute();

    if (route.page === 'editor') {
      if (selectedPlanning) {
        return;
      }

      if (plannings.length === 0) {
        void loadAppData({ userOverride: user });
        return;
      }

      updateLocation('plannings', undefined, true);
      setCurrentPage('plannings');
      setSelectedPlanning(null);
      return;
    }
  }, [
    currentPage,
    isBootstrapping,
    loadAppData,
    plannings.length,
    selectedPlanning,
    updateLocation,
    user,
  ]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await api.post<{ data: { user: User; session: { token: string } } }>('/api/auth/login', {
        email,
        password,
      });

      const nextUser = response.data.data.user;
      const token = response.data.data.session.token;
      persistToken(token);
      setAuthToken(token);
      setUser(nextUser);
      updateLocation('dashboard');
      syncRouteFromLocation();
      await loadAppData({ userOverride: nextUser });
      toast('Connexion réussie.', 'success');
      return null;
    } catch (error) {
      const backendError = handlePossibleAuthError(error, true);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return backendError;
    } finally {
      setIsLoading(false);
    }
  }, [handlePossibleAuthError, loadAppData, syncRouteFromLocation, toast, updateLocation]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await api.post<{ data: { user: User; session: { token: string } } }>('/api/auth/register', {
        name,
        email,
        password,
      });

      const nextUser = response.data.data.user;
      const token = response.data.data.session.token;
      persistToken(token);
      setAuthToken(token);
      setUser(nextUser);
      updateLocation('dashboard');
      syncRouteFromLocation();
      await loadAppData({ userOverride: nextUser });
      toast('Compte créé avec succès.', 'success');
      return null;
    } catch (error) {
      const backendError = handlePossibleAuthError(error, true);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return backendError;
    } finally {
      setIsLoading(false);
    }
  }, [handlePossibleAuthError, loadAppData, syncRouteFromLocation, toast, updateLocation]);

  const updateProfile = useCallback(async (name: string, email: string) => {
    setIsLoading(true);

    try {
      const response = await api.patch<{ data: { user: User } }>('/api/auth/me', {
        name,
        email,
      });

      setUser(response.data.data.user);
      toast('Profil mis à jour.', 'success');
      return null;
    } catch (error) {
      const backendError = handlePossibleAuthError(error, true);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return backendError;
    } finally {
      setIsLoading(false);
    }
  }, [handlePossibleAuthError, toast]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // The session may already be invalid, we still clear the local state.
    }

    clearSession('landing');
    toast('Vous avez ete deconnecte.', 'info');
  }, [clearSession, toast]);

  const navigate = useCallback((page: string, params?: any) => {
    const nextPlanning = params?.planning ?? null;
    const routeParams = {
      planningId: nextPlanning?.id,
    };

    updateLocation(page, routeParams);
    setCurrentPage(page);
    setSelectedPlanning(nextPlanning);
  }, [updateLocation]);

  const applyPlanningUpdate = useCallback((planning: Planning) => {
    setPlannings(prev => {
      const exists = prev.some(item => item.id === planning.id);
      const next = exists
        ? prev.map(item => (item.id === planning.id ? planning : item))
        : [planning, ...prev];

      syncSelections(next);
      return next;
    });
    setSelectedPlanning(prev => (prev?.id === planning.id ? planning : prev));
  }, [syncSelections]);

  const createPlanning = useCallback(async (title: string, badges?: Badge[]) => {
    try {
      const response = await api.post<{ data: { planning: Planning } }>('/api/plannings', {
        title,
        ...(badges && badges.length > 0 ? { badges } : {}),
      });

      const planning = response.data.data.planning;
      applyPlanningUpdate(planning);
      await refreshData();
      toast('Planification creee avec succes.', 'success');
      return planning;
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return null;
    }
  }, [applyPlanningUpdate, handlePossibleAuthError, refreshData, toast]);

  const savePlanningData = useCallback(async (id: string, payload: SavePlanningInput) => {
    try {
      const response = await api.patch<{ data: { planning: Planning } }>(`/api/plannings/${id}`, payload);
      const planning = response.data.data.planning;
      applyPlanningUpdate(planning);
      await refreshData();
      return planning;
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return null;
    }
  }, [applyPlanningUpdate, handlePossibleAuthError, refreshData, toast]);

  const solvePlanning = useCallback(async (
    id: string,
    data?: Record<string, any>,
    source?: string,
    solver?: string,
    solverTimeLimitSeconds?: number
  ) => {
    try {
      const body: Record<string, any> = {};
      if (data) body.data = data;
      if (source) body.source = source;
      if (solver) body.solver = solver;
      if (typeof solverTimeLimitSeconds === 'number' && Number.isFinite(solverTimeLimitSeconds)) {
        body.solverTimeLimitSeconds = Math.max(1, Math.floor(solverTimeLimitSeconds));
      }
      const response = await api.post<{ data: { planning: Planning; result: { output: string; warnings: string[]; solveTimeMs: number } } }>(
        `/api/plannings/${id}/solve`,
        body
      );

      const planning = response.data.data.planning;
      applyPlanningUpdate(planning);
      await refreshData();
      return {
        planning,
        output: response.data.data.result.output,
        warnings: response.data.data.result.warnings,
        solveTimeMs: response.data.data.result.solveTimeMs ?? 0,
      };
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      await refreshData();
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return null;
    }
  }, [applyPlanningUpdate, handlePossibleAuthError, refreshData, toast]);

  const listPlanningVersions = useCallback(async (planningId: string) => {
    try {
      const response = await api.get<{ data: { versions: PlanningSolutionVersion[] } }>(`/api/plannings/${planningId}/versions`);
      return response.data.data.versions ?? [];
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return [];
    }
  }, [handlePossibleAuthError, toast]);

  const deletePlanningVersion = useCallback(async (planningId: string, versionId: string) => {
    try {
      await api.delete(`/api/plannings/${planningId}/versions/${versionId}`);
      toast('Version supprimée.', 'success');
      return true;
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return false;
    }
  }, [handlePossibleAuthError, toast]);

  const updatePlanningStatus = useCallback(async (id: string, status: PlanStatus) => {
    await savePlanningData(id, { status });
  }, [savePlanningData]);

  const updatePlanningStep = useCallback(async (id: string, step: number, data?: Record<string, any>) => {
    const current = plannings.find(planning => planning.id === id) ?? selectedPlanning;
    const totalSteps = current?.totalSteps ?? 7;
    const progress = Math.round((step / totalSteps) * 100);
    const status: PlanStatus = step >= totalSteps ? 'done' : 'active';

    await savePlanningData(id, {
      currentStep: step,
      totalSteps,
      progress,
      status,
      data,
    });
  }, [plannings, savePlanningData, selectedPlanning]);

  const deletePlanning = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/plannings/${id}`);
      setPlannings(prev => prev.filter(planning => planning.id !== id));
      if (selectedPlanning?.id === id) {
        setSelectedPlanning(null);
        updateLocation('plannings', undefined, true);
        setCurrentPage('plannings');
      }
      await refreshData();
      toast('Planification supprimee.', 'success');
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
    }
  }, [handlePossibleAuthError, refreshData, selectedPlanning, toast, updateLocation]);


  const createBadge = useCallback(async (name: string, color: string) => {
    try {
      const response = await api.post<{ data: { tag: Badge } }>('/api/tags', { name, color });
      const tag = response.data.data.tag;
      setBadges(prev => [...prev, tag]);
      return tag;
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
      return null;
    }
  }, [handlePossibleAuthError, toast]);

  const deleteBadge = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/tags/${id}`);
      setBadges(prev => prev.filter(b => b.id !== id));
      toast('Badge supprime.', 'success');
    } catch (error) {
      const backendError = handlePossibleAuthError(error);
      if (backendError.code !== 'AUTH_REQUIRED' && backendError.code !== 'INVALID_SESSION') {
        toast(backendError.message, 'error');
      }
    }
  }, [handlePossibleAuthError, toast]);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isBootstrapping,
        plannings,
        badges,
        currentPage,
        selectedPlanning,
        sidebarOpen,
        login,
        logout,
        register,
        updateProfile,
        navigate,
        setSelectedPlanning,
        setSidebarOpen,
        createPlanning,
        updatePlanningStatus,
        updatePlanningStep,
        savePlanningData,
        solvePlanning,
        listPlanningVersions,
        deletePlanningVersion,
        deletePlanning,
        createBadge,
        deleteBadge,
        refreshData,
        toast,
        toasts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
