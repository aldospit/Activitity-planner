export const getPublicOrigin = (): string => {
  try {
    const customProdUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_production_url') : null;
    if (customProdUrl && customProdUrl.trim().length > 0) {
      const trimmed = customProdUrl.trim();
      // Google AI Studio does not host user applets on *.ai.studio subdomains.
      // If someone configured an *.ai.studio domain (like activitityplanner.ai.studio), ignore it to prevent 404 errors.
      if (!trimmed.includes('.ai.studio')) {
        return trimmed;
      }
    }
  } catch {
    // localStorage may be restricted in some iframe contexts
  }
  
  if (typeof window !== 'undefined' && window.location?.origin) {
    // In Google AI Studio, internal dev preview uses ais-dev-*.
    // The public, shared standalone application URL uses ais-pre-*.
    if (window.location.hostname.startsWith('ais-dev-')) {
      return window.location.origin.replace('ais-dev-', 'ais-pre-');
    }
    return window.location.origin;
  }

  return 'https://ais-pre-xytdoe6esnnn7e5e7sudzv-677953799143.europe-west2.run.app';
};


