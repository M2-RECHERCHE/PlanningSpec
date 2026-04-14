export interface AppRoute {
  page: string;
  projectId?: string;
  planningId?: string;
}

const normalizeHashPath = (hash: string) => {
  const raw = hash.replace(/^#/, '') || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
};

export const parseRoute = (hash: string): AppRoute => {
  const path = normalizeHashPath(hash);
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (segments.length === 0) {
    return { page: 'landing' };
  }

  if (segments[0] === 'login') {
    return { page: 'login' };
  }

  if (segments[0] === 'register') {
    return { page: 'register' };
  }

  if (segments[0] === 'dashboard') {
    return { page: 'dashboard' };
  }

  if (segments[0] === 'profile') {
    return { page: 'profile' };
  }

  if (segments[0] === 'projects') {
    if (segments[1] === 'new') {
      return { page: 'newProject' };
    }

    if (segments[1]) {
      return { page: 'projectDetail', projectId: segments[1] };
    }

    return { page: 'projects' };
  }

  if (segments[0] === 'plannings') {
    if (segments[1] === 'new') {
      return { page: 'newPlanning' };
    }

    if (segments[1] && segments[2] === 'editor') {
      return { page: 'editor', planningId: segments[1] };
    }

    if (segments[1] && segments[2] === 'report') {
      return { page: 'report', planningId: segments[1] };
    }

    return { page: 'plannings' };
  }

  return { page: 'landing' };
};

export const buildRoute = (page: string, params?: { projectId?: string; planningId?: string }) => {
  switch (page) {
    case 'login':
      return '/login';
    case 'register':
      return '/register';
    case 'dashboard':
      return '/dashboard';
    case 'projects':
      return '/projects';
    case 'projectDetail':
      return params?.projectId ? `/projects/${encodeURIComponent(params.projectId)}` : '/projects';
    case 'plannings':
      return '/plannings';
    case 'editor':
      return params?.planningId ? `/plannings/${encodeURIComponent(params.planningId)}/editor` : '/plannings';
    case 'report':
      return params?.planningId ? `/plannings/${encodeURIComponent(params.planningId)}/report` : '/plannings';
    case 'profile':
      return '/profile';
    case 'newPlanning':
      return '/plannings/new';
    case 'newProject':
      return '/projects/new';
    case 'landing':
    default:
      return '/';
  }
};

export const readCurrentRoute = (): AppRoute => {
  if (typeof window === 'undefined') {
    return { page: 'landing' };
  }

  return parseRoute(window.location.hash);
};

export const hasExplicitHashRoute = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hash = window.location.hash.trim();
  return hash !== '' && hash !== '#' && hash !== '#/';
};
