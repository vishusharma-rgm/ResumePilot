const { analyzeResumeWithAI } = require('./openaiService');

const COMPANY_TEMPLATES = [
  {
    companyId: 'code-orbit',
    companyName: 'CodeOrbit',
    role: 'Backend Developer',
    requiredSkills: [
      { skill: 'Node', weight: 25 },
      { skill: 'Express', weight: 20 },
      { skill: 'MongoDB', weight: 20 },
      { skill: 'SQL', weight: 15 },
      { skill: 'System Design', weight: 20 },
    ],
  },
  {
    companyId: 'pixel-forge',
    companyName: 'PixelForge',
    role: 'Frontend Developer',
    requiredSkills: [
      { skill: 'React', weight: 30 },
      { skill: 'JavaScript', weight: 20 },
      { skill: 'TypeScript', weight: 20 },
      { skill: 'CSS', weight: 15 },
      { skill: 'REST API', weight: 15 },
    ],
  },
  {
    companyId: 'data-sphere',
    companyName: 'DataSphere',
    role: 'Data Analyst',
    requiredSkills: [
      { skill: 'Python', weight: 30 },
      { skill: 'SQL', weight: 30 },
      { skill: 'Statistics', weight: 20 },
      { skill: 'Excel', weight: 20 },
    ],
  },
];

const TEST_STORE = new Map();
const INTERVIEW_STORE = new Map();
const SKILL_DISPLAY_MAP = {
  sql: 'SQL',
  mongodb: 'MongoDB',
  api: 'API',
  dsa: 'DSA',
  aws: 'AWS',
  css: 'CSS',
};
const DEFAULT_TEST_SKILLS = [
  'JavaScript',
  'Node',
  'React',
  'SQL',
  'Git',
];

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const toTitleCase = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => SKILL_DISPLAY_MAP[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeSkill = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dedupeSkills = (skills) => {
  const seen = new Set();
  const output = [];

  for (const rawSkill of skills || []) {
    const normalized = normalizeSkill(rawSkill);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(toTitleCase(rawSkill));
  }

  return output;
};

const buildQuestionSetForSkill = (skill) => {
  const key = normalizeSkill(skill);
  const prettySkill = toTitleCase(skill);

  const genericQuestions = [
    {
      type: 'mcq',
      prompt: `Which statement best explains a real-world use of ${prettySkill}?`,
      options: [
        `Applying ${prettySkill} to solve production-level problems with measurable outcomes`,
        `${prettySkill} is only for writing comments and documentation`,
        `${prettySkill} cannot be used in team projects`,
        `${prettySkill} is unrelated to software/product delivery`,
      ],
      correctAnswer: 0,
      weight: 50,
    },
    {
      type: 'mcq',
      prompt: `You claimed ${prettySkill} in your resume. Which behavior shows practical proficiency?`,
      options: [
        `Can explain tradeoffs, debug issues, and deliver small features independently`,
        `Has heard the name but never used it`,
        `Only copied examples without understanding`,
        `Avoids tasks involving ${prettySkill}`,
      ],
      correctAnswer: 0,
      weight: 50,
    },
  ];

  if (key === 'sql') {
    genericQuestions[0] = {
      type: 'mcq',
      prompt: 'Which SQL query returns employees with salary > 50000 sorted descending?',
      options: [
        'SELECT * FROM employees WHERE salary > 50000 ORDER BY salary DESC;',
        'SELECT employees salary > 50000 SORT DESC;',
        'FETCH employees BY salary DESC IF salary > 50000;',
        'ORDER employees DESC WHERE salary > 50000;',
      ],
      correctAnswer: 0,
      weight: 50,
    };
  }

  if (key === 'react') {
    genericQuestions[0] = {
      type: 'mcq',
      prompt: 'In React, which hook is typically used for local component state?',
      options: ['useState', 'useContextProvider', 'setInterval', 'useRoute'],
      correctAnswer: 0,
      weight: 50,
    };
  }

  if (key === 'node') {
    genericQuestions[0] = {
      type: 'mcq',
      prompt: 'What is Node.js primarily used for?',
      options: [
        'Running JavaScript on the server/runtime environment',
        'Styling HTML pages',
        'Designing logos',
        'Creating spreadsheet formulas',
      ],
      correctAnswer: 0,
      weight: 50,
    };
  }

  return genericQuestions.map((question) => ({
    ...question,
    id: uid('q'),
    skill: prettySkill,
  }));
};

const stripAnswerKey = (question) => ({
  id: question.id,
  skill: question.skill,
  type: question.type,
  prompt: question.prompt,
  options: question.options,
  weight: question.weight,
});

const getRequestedCompanies = (companyIds = []) => {
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return COMPANY_TEMPLATES;
  }

  const idSet = new Set(companyIds.map((item) => String(item || '').trim().toLowerCase()));
  const matched = COMPANY_TEMPLATES.filter((company) => idSet.has(company.companyId));
  return matched.length > 0 ? matched : COMPANY_TEMPLATES;
};

const buildCompanyShortlist = ({ skillScores = {}, claimedSkills = [], companies = [] }) => {
  const normalizedClaimSet = new Set((claimedSkills || []).map((skill) => normalizeSkill(skill)));

  const result = companies.map((company) => {
    const totalWeight = company.requiredSkills.reduce((sum, item) => sum + item.weight, 0) || 1;
    let weightedTestScore = 0;
    let weightedClaimCoverage = 0;
    let matchedRequirementCount = 0;

    for (const requirement of company.requiredSkills) {
      const normalizedSkill = normalizeSkill(requirement.skill);
      const skillTestScore = Number(skillScores[normalizedSkill] || 0);
      const inResume = normalizedClaimSet.has(normalizedSkill) ? 100 : 0;
      if (inResume > 0) {
        matchedRequirementCount += 1;
      }

      weightedTestScore += skillTestScore * requirement.weight;
      weightedClaimCoverage += inResume * requirement.weight;
    }

    const normalizedTestScore = weightedTestScore / totalWeight;
    const normalizedClaimScore = weightedClaimCoverage / totalWeight;
    const fitScore = Math.round(normalizedTestScore);

    return {
      companyId: company.companyId,
      companyName: company.companyName,
      role: company.role,
      fitScore,
      testScore: Math.round(normalizedTestScore),
      claimCoverage: Math.round(normalizedClaimScore),
      matchedRequirementCount,
    };
  });

  return result
    .filter((company) => company.matchedRequirementCount > 0 && company.claimCoverage > 0)
    .sort((a, b) => b.fitScore - a.fitScore)
    .map(({ matchedRequirementCount, ...company }) => company);
};

const createResumeClaimTest = async ({ resumeText, requestedCompanies = [] }) => {
  const aiResult = await analyzeResumeWithAI({
    resumeText,
    requiredSkills: [],
  });

  const extractedSkills = dedupeSkills(aiResult.extractedSkills);
  const fallbackFromCompanies = dedupeSkills(
    getRequestedCompanies(requestedCompanies)
      .flatMap((company) => company.requiredSkills.map((item) => item.skill))
  );
  const claimedSkills = (
    extractedSkills.length ? extractedSkills :
      (fallbackFromCompanies.length ? fallbackFromCompanies : DEFAULT_TEST_SKILLS)
  ).slice(0, 8);

  const questions = claimedSkills.flatMap((skill) => buildQuestionSetForSkill(skill));
  const testId = uid('test');

  TEST_STORE.set(testId, {
    testId,
    createdAt: new Date().toISOString(),
    claimedSkills,
    questions,
    requestedCompanies,
  });

  return {
    testId,
    claimedSkills,
    questionCount: questions.length,
    questions: questions.map(stripAnswerKey),
  };
};

const evaluateResumeClaimTest = ({ testId, answers = [], requestedCompanies = [] }) => {
  const test = TEST_STORE.get(testId);

  if (!test) {
    throw new Error('Invalid testId or test expired. Please generate a new test.');
  }

  const answerMap = new Map((answers || []).map((item) => [String(item.questionId || ''), Number(item.selectedOption)]));

  const perSkill = {};
  let answeredQuestionCount = 0;

  for (const question of test.questions) {
    const normalizedSkill = normalizeSkill(question.skill);
    if (!perSkill[normalizedSkill]) {
      perSkill[normalizedSkill] = {
        skill: question.skill,
        score: 0,
        totalWeight: 0,
      };
    }

    const selectedOption = answerMap.get(question.id);
    const isAnswered = Number.isInteger(selectedOption) && selectedOption >= 0;
    if (!isAnswered) {
      continue;
    }

    answeredQuestionCount += 1;
    perSkill[normalizedSkill].totalWeight += question.weight;
    if (selectedOption === question.correctAnswer) {
      perSkill[normalizedSkill].score += question.weight;
    }
  }

  const skillScores = {};
  for (const [normalizedSkill, value] of Object.entries(perSkill)) {
    skillScores[normalizedSkill] = value.totalWeight > 0
      ? Math.round((value.score / value.totalWeight) * 100)
      : 0;
  }

  const claimedNormalized = test.claimedSkills.map((skill) => normalizeSkill(skill));
  const authenticityScore = claimedNormalized.length > 0
    ? Math.round(claimedNormalized.reduce((sum, item) => sum + Number(skillScores[item] || 0), 0) / claimedNormalized.length)
    : 0;

  const skillBreakdown = Object.values(perSkill)
    .filter((item) => item.totalWeight > 0)
    .map((item) => ({
      skill: item.skill,
      score: Math.round((item.score / item.totalWeight) * 100),
    }));

  if (answeredQuestionCount === 0) {
    return {
      testId,
      claimStatus: 'not_attempted',
      authenticityScore: 0,
      skillBreakdown: [],
      shortlist: [],
    };
  }

  const companies = getRequestedCompanies(requestedCompanies.length > 0 ? requestedCompanies : test.requestedCompanies);
  const shortlist = buildCompanyShortlist({
    skillScores,
    claimedSkills: test.claimedSkills,
    companies,
  });

  const claimStatus = authenticityScore >= 75
    ? 'strongly_verified'
    : authenticityScore >= 50
      ? 'partially_verified'
      : 'weakly_verified';

  return {
    testId,
    claimStatus,
    authenticityScore,
    skillBreakdown,
    shortlist,
  };
};

const buildInterviewQuestions = (company) => {
  const skills = company.requiredSkills.map((item) => item.skill).slice(0, 5);
  const role = String(company.role || "").toLowerCase();
  const scenarioSkill = skills[0] || "System Design";
  const debugSkill = skills[1] || "APIs";

  const roleSpecificQuestion = (() => {
    if (role.includes("frontend")) {
      return {
        id: uid('q'),
        skill: toTitleCase(scenarioSkill),
        type: 'scenario',
        prompt: 'Your page has become slow after shipping a new component tree. What should you do first?',
        options: [
          'Profile render paths, identify expensive updates, and optimize re-render behavior',
          'Increase font size to improve perceived speed',
          'Remove error boundaries from the app',
          'Disable caching for all static assets',
        ],
        correctAnswer: 0,
        weight: 100,
      };
    }
    if (role.includes("data")) {
      return {
        id: uid('q'),
        skill: toTitleCase(scenarioSkill),
        type: 'scenario',
        prompt: 'A dashboard metric dropped 20% overnight. What is the best first response?',
        options: [
          'Validate data pipeline freshness, compare source integrity, and segment the drop by cohort',
          'Immediately change the chart type',
          'Delete yesterday’s records and rerun manually',
          'Assume seasonality without checking',
        ],
        correctAnswer: 0,
        weight: 100,
      };
    }
    return {
      id: uid('q'),
      skill: toTitleCase(scenarioSkill),
      type: 'scenario',
      prompt: 'API latency doubled after a release. What should be your first step?',
      options: [
        'Check release diff, inspect traces, and isolate the slow path before rollback/patch',
        'Add more random retries without investigation',
        'Ignore unless errors increase',
        'Disable all monitoring alerts',
      ],
      correctAnswer: 0,
      weight: 100,
    };
  })();

  const roleSpecificDebugQuestion = (() => {
    if (role.includes("frontend")) {
      return {
        id: uid('q'),
        skill: toTitleCase(debugSkill),
        type: 'debug',
        prompt: 'A React form loses input state when switching tabs. Most likely cause?',
        options: [
          'Component remounting due to unstable keys or route-level unmounting',
          'Using semantic HTML labels',
          'Using CSS modules',
          'Running Prettier on save',
        ],
        correctAnswer: 0,
        weight: 100,
      };
    }
    if (role.includes("data")) {
      return {
        id: uid('q'),
        skill: toTitleCase(debugSkill),
        type: 'debug',
        prompt: 'SQL totals are inflated after a JOIN. Most common root cause?',
        options: [
          'One-to-many join duplication without proper grouping/deduplication',
          'Using uppercase SQL keywords',
          'Adding ORDER BY',
          'Using aliases in SELECT',
        ],
        correctAnswer: 0,
        weight: 100,
      };
    }
    return {
      id: uid('q'),
      skill: toTitleCase(debugSkill),
      type: 'debug',
      prompt: 'User data endpoint returns stale values after update. Most likely issue?',
      options: [
        'Cache invalidation/TTL path is missing after write',
        'TLS certificate was renewed',
        'Console logs are disabled',
        'Response JSON is pretty-printed',
      ],
      correctAnswer: 0,
      weight: 100,
    };
  })();

  const rounds = [
    {
      roundId: uid('round'),
      title: 'Technical Basics',
      questions: skills.slice(0, 3).map((skill) => buildQuestionSetForSkill(skill)[0]),
    },
    {
      roundId: uid('round'),
      title: 'Applied Scenarios',
      questions: [
        roleSpecificQuestion,
        ...skills.slice(1, 2).map((skill) => ({
          id: uid('q'),
          skill: toTitleCase(skill),
          type: 'scenario',
          prompt: `In production, what best demonstrates strong ${toTitleCase(skill)} ownership?`,
          options: [
            'Can explain tradeoffs, deliver measurable outcomes, and handle failures',
            'Only discusses theory and avoids implementation',
            'Copies snippets without context',
            'Avoids code reviews and incident follow-up',
          ],
          correctAnswer: 0,
          weight: 100,
        })),
      ],
    },
    {
      roundId: uid('round'),
      title: 'Debug & Decision',
      questions: [roleSpecificDebugQuestion],
    },
  ];

  return rounds;
};

const createInterviewSimulation = ({ companyId, resumeSkills = [] }) => {
  const company = getRequestedCompanies(companyId ? [companyId] : [])[0] || COMPANY_TEMPLATES[0];
  const rounds = buildInterviewQuestions(company);
  const questions = rounds.flatMap((round) => round.questions);
  const sessionId = uid('interview');

  INTERVIEW_STORE.set(sessionId, {
    sessionId,
    company,
    resumeSkills: dedupeSkills(resumeSkills),
    rounds,
    createdAt: new Date().toISOString(),
  });

  return {
    sessionId,
    company: {
      companyId: company.companyId,
      companyName: company.companyName,
      role: company.role,
    },
    rounds: rounds.map((round) => ({
      roundId: round.roundId,
      title: round.title,
      questions: round.questions.map(stripAnswerKey),
    })),
    totalQuestions: questions.length,
    estimatedMinutes: Math.max(10, questions.length * 2),
  };
};

const evaluateInterviewSimulation = ({ sessionId, answers = [] }) => {
  const session = INTERVIEW_STORE.get(sessionId);
  if (!session) {
    throw new Error('Invalid interview session. Please start a new simulation.');
  }

  const answerMap = new Map((answers || []).map((item) => [String(item.questionId || ''), Number(item.selectedOption)]));
  const roundBreakdown = session.rounds.map((round) => {
    let total = 0;
    let correct = 0;
    for (const question of round.questions) {
      const selectedOption = answerMap.get(question.id);
      const isAnswered = Number.isInteger(selectedOption) && selectedOption >= 0;
      if (!isAnswered) {
        continue;
      }
      total += 1;
      if (selectedOption === question.correctAnswer) {
        correct += 1;
      }
    }
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { roundId: round.roundId, title: round.title, answered: total, score };
  });

  const answeredCount = roundBreakdown.reduce((sum, item) => sum + item.answered, 0);
  const totalQuestions = session.rounds.reduce((sum, round) => sum + round.questions.length, 0);
  const weightedScore = roundBreakdown.length
    ? Math.round(roundBreakdown.reduce((sum, item) => sum + item.score, 0) / roundBreakdown.length)
    : 0;
  const recommendation = weightedScore >= 75
    ? 'Strongly interview-ready for this company baseline.'
    : weightedScore >= 50
      ? 'Partially ready. Improve weak round areas before applying.'
      : 'Needs focused preparation before shortlist-level interviews.';

  return {
    sessionId,
    company: {
      companyId: session.company.companyId,
      companyName: session.company.companyName,
      role: session.company.role,
    },
    overallScore: weightedScore,
    answeredCount,
    totalQuestions,
    roundBreakdown,
    recommendation,
  };
};

module.exports = {
  COMPANY_TEMPLATES,
  createResumeClaimTest,
  evaluateResumeClaimTest,
  createInterviewSimulation,
  evaluateInterviewSimulation,
};
