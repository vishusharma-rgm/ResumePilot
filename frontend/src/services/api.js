const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const LOCAL_BACKEND_BASE = 'http://localhost:5000/api';

const buildApiCandidates = () => {
  const candidates = [API_BASE_URL];
  if (API_BASE_URL !== LOCAL_BACKEND_BASE) {
    candidates.push(LOCAL_BACKEND_BASE);
  }
  return candidates;
};

const fetchWithBaseFallback = async (path, options = {}) => {
  const candidates = buildApiCandidates();
  let lastError = null;

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const base = candidates[idx];
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Network request failed.');
};

const parseSkills = (requiredSkills) => {
  if (Array.isArray(requiredSkills)) {
    return requiredSkills.filter(Boolean).join(',');
  }
  return String(requiredSkills || '').trim();
};

export const analyzeResumeApi = async ({ file, requiredSkills = [] }) => {
  const formData = new FormData();
  formData.append('resume', file);

  const skills = parseSkills(requiredSkills);
  if (skills) {
    formData.append('requiredSkills', skills);
  }

  const response = await fetchWithBaseFallback('/analyze-resume', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Resume analysis failed.');
  }

  return response.json();
};

export const generateClaimTestApi = async ({ file, companyIds = [] }) => {
  const formData = new FormData();
  formData.append('resume', file);

  if (Array.isArray(companyIds) && companyIds.length > 0) {
    formData.append('companyIds', companyIds.join(','));
  }

  const response = await fetchWithBaseFallback('/generate-claim-test', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Claim test generation failed.');
  }

  return response.json();
};

export const submitClaimTestApi = async ({ testId, answers = [], companyIds = [] }) => {
  const response = await fetchWithBaseFallback('/submit-claim-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ testId, answers, companyIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Claim test submission failed.');
  }

  return response.json();
};

export const startInterviewSimApi = async ({ companyId, resumeSkills = [] }) => {
  const response = await fetchWithBaseFallback('/start-interview-sim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, resumeSkills }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Interview simulation start failed.');
  }

  return response.json();
};

export const submitInterviewSimApi = async ({ sessionId, answers = [] }) => {
  const response = await fetchWithBaseFallback('/submit-interview-sim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, answers }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Interview simulation submission failed.');
  }

  return response.json();
};

export const generateProjectPlanApi = async ({ role, missingSkills = [], extractedSkills = [] }) => {
  const response = await fetchWithBaseFallback('/generate-project-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, missingSkills, extractedSkills }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Project plan generation failed.');
  }

  return response.json();
};
