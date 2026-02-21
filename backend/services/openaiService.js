const openai = require("../config/openai");

const FALLBACK_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node",
  "Express",
  "MongoDB",
  "SQL",
  "Python",
  "Java",
  "C++",
  "AWS",
  "Docker",
  "Kubernetes",
  "System Design",
  "DSA",
  "REST API",
  "Git",
];

const extractSkillsFallback = (resumeText) => {
  const lowerText = resumeText.toLowerCase();

  return FALLBACK_SKILLS.filter((skill) =>
    lowerText.includes(skill.toLowerCase())
  );
};

const analyzeResumeWithAI = async ({ resumeText, requiredSkills = [] }) => {
  if (!resumeText) {
    throw new Error("resumeText is required for AI analysis.");
  }

  if (!openai) {
    return {
      extractedSkills: extractSkillsFallback(resumeText),
      improvementSuggestions:
        "Add measurable project impact, highlight missing core backend/database skills, and tailor summary to the target role.",
    };
  }

  const prompt = `You are a resume analyzer. Return strict JSON with keys: extractedSkills (string[]), improvementSuggestions (string).

Required skills (if provided): ${JSON.stringify(requiredSkills)}

Resume text:\n${resumeText}`;

  let outputText = "";
  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });
    outputText = response.output_text || "";
  } catch (error) {
    console.warn("OpenAI request failed, using fallback:", error.message);
    return {
      extractedSkills: extractSkillsFallback(resumeText),
      improvementSuggestions:
        "Auto-fallback mode: improve missing required skills and add quantified project outcomes.",
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_error) {
    parsed = {
      extractedSkills: extractSkillsFallback(resumeText),
      improvementSuggestions:
        "Improve role-specific keywords and include missing technical skills from job requirements.",
    };
  }

  return {
    extractedSkills: Array.isArray(parsed.extractedSkills)
      ? parsed.extractedSkills.filter(Boolean)
      : extractSkillsFallback(resumeText),
    improvementSuggestions:
      typeof parsed.improvementSuggestions === "string"
        ? parsed.improvementSuggestions
        : "Improve resume clarity and add missing job-relevant skills.",
  };
};

const buildProjectBlueprintFallback = ({ role = "Backend Developer", missingSkills = [], extractedSkills = [] }) => {
  const focusSkills = (missingSkills.length ? missingSkills : extractedSkills).slice(0, 3);
  const skillLabel = focusSkills.join(", ") || "core role skills";
  return {
    title: `${role} Gap-Closing Project`,
    summary: `Build one production-style project focused on ${skillLabel} with measurable outcomes.`,
    milestones: [
      {
        week: 1,
        title: "Scope and Architecture",
        goal: "Define features, architecture, and acceptance criteria.",
      },
      {
        week: 2,
        title: "Core Implementation",
        goal: "Implement core modules and validate with tests.",
      },
      {
        week: 3,
        title: "Polish and Deploy",
        goal: "Deploy, add metrics, and complete documentation.",
      },
    ],
    deliverables: [
      "Public Git repository with README",
      "Demo link or deployed environment",
      "Test report and architecture notes",
    ],
    resumeBullets: [
      "Built and deployed a project aligned to target role requirements.",
      "Implemented measurable improvements with tests and documentation.",
    ],
  };
};

const generateProjectBlueprintWithAI = async ({ role = "Backend Developer", missingSkills = [], extractedSkills = [] }) => {
  const safeRole = String(role || "Backend Developer").trim() || "Backend Developer";
  const normalizedMissing = Array.isArray(missingSkills) ? missingSkills.filter(Boolean) : [];
  const normalizedExtracted = Array.isArray(extractedSkills) ? extractedSkills.filter(Boolean) : [];

  if (!openai) {
    return buildProjectBlueprintFallback({
      role: safeRole,
      missingSkills: normalizedMissing,
      extractedSkills: normalizedExtracted,
    });
  }

  const prompt = `You are a career coach and engineering mentor.
Return strict JSON only with keys:
title (string),
summary (string),
milestones (array of {week:number,title:string,goal:string}),
deliverables (string[]),
resumeBullets (string[]).

Target role: ${safeRole}
Missing skills: ${JSON.stringify(normalizedMissing)}
Existing strengths: ${JSON.stringify(normalizedExtracted)}

Make the plan practical, measurable, and portfolio-friendly.`;

  let outputText = "";
  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });
    outputText = response.output_text || "";
    const parsed = JSON.parse(outputText);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid AI blueprint response.");
    }
    return {
      title: String(parsed.title || "").trim() || `${safeRole} Gap-Closing Project`,
      summary: String(parsed.summary || "").trim() || "Build a practical project to close top role gaps.",
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones.slice(0, 6) : buildProjectBlueprintFallback({ role: safeRole, missingSkills: normalizedMissing, extractedSkills: normalizedExtracted }).milestones,
      deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.slice(0, 8) : [],
      resumeBullets: Array.isArray(parsed.resumeBullets) ? parsed.resumeBullets.slice(0, 6) : [],
    };
  } catch (error) {
    console.warn("Project blueprint generation failed, using fallback:", error.message);
    return buildProjectBlueprintFallback({
      role: safeRole,
      missingSkills: normalizedMissing,
      extractedSkills: normalizedExtracted,
    });
  }
};

module.exports = {
  analyzeResumeWithAI,
  generateProjectBlueprintWithAI,
};
