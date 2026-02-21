const Resume = require("../models/Resume");
const AnalysisResult = require("../models/AnalysisResult");
const mongoose = require("mongoose");
const { extractTextFromPdf } = require("../services/resumeParser");
const { parseLinkedInLikeProfile } = require("../services/linkedinParser");
const { analyzeResumeWithAI, generateProjectBlueprintWithAI } = require("../services/openaiService");
const { computeSkillMatch } = require("../services/skillMatcher");
const { calculateScore } = require("../utils/scoringUtils");
const CandidateAssessment = require("../models/CandidateAssessment");
const {
  COMPANY_TEMPLATES,
  createResumeClaimTest,
  evaluateResumeClaimTest,
  createInterviewSimulation,
  evaluateInterviewSimulation,
} = require("../services/assessmentService");

const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF file is required." });
    }

    const requiredSkills = Array.isArray(req.body.requiredSkills)
      ? req.body.requiredSkills
      : typeof req.body.requiredSkills === "string"
        ? req.body.requiredSkills.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const originalText = await extractTextFromPdf(req.file.buffer);

    const aiResult = await analyzeResumeWithAI({
      resumeText: originalText,
      requiredSkills,
    });

    const skillMatch = computeSkillMatch({
      resumeSkills: aiResult.extractedSkills,
      requiredSkills,
    });

    const score = calculateScore({
      matchedSkillsCount: skillMatch.matchedSkills.length,
      totalRequiredSkills: skillMatch.requiredSkills.length,
    });

    if (mongoose.connection.readyState === 1) {
      const resumeDoc = await Resume.create({
        originalText,
        extractedSkills: aiResult.extractedSkills,
      });

      await AnalysisResult.create({
        resumeId: resumeDoc._id,
        score,
        matchedSkills: skillMatch.matchedSkills,
        missingSkills: skillMatch.missingSkills,
        suggestions: aiResult.improvementSuggestions,
      });
    }

    return res.status(200).json({
      score,
      extractedSkills: aiResult.extractedSkills,
      matchedSkills: skillMatch.matchedSkills,
      missingSkills: skillMatch.missingSkills,
      suggestions: aiResult.improvementSuggestions,
    });
  } catch (error) {
    console.error("Resume analysis failed:", error);
    return res.status(500).json({
      error: "Resume analysis failed.",
      details: error.message,
    });
  }
};

const parseLinkedInProfile = async (req, res) => {
  try {
    const profileText = String(req.body.profileText || "").trim();
    if (!profileText) {
      return res.status(400).json({ error: "profileText is required." });
    }

    const requiredSkills = Array.isArray(req.body.requiredSkills)
      ? req.body.requiredSkills
      : typeof req.body.requiredSkills === "string"
        ? req.body.requiredSkills.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const profile = parseLinkedInLikeProfile(profileText);

    const aiResult = await analyzeResumeWithAI({
      resumeText: profileText,
      requiredSkills,
    });

    const skillMatch = computeSkillMatch({
      resumeSkills: aiResult.extractedSkills,
      requiredSkills,
    });

    const score = calculateScore({
      matchedSkillsCount: skillMatch.matchedSkills.length,
      totalRequiredSkills: skillMatch.requiredSkills.length,
    });

    return res.status(200).json({
      source: "linkedin-like-parser",
      profile,
      score,
      extractedSkills: aiResult.extractedSkills,
      matchedSkills: skillMatch.matchedSkills,
      missingSkills: skillMatch.missingSkills,
      suggestions: aiResult.improvementSuggestions,
    });
  } catch (error) {
    console.error("LinkedIn-like parsing failed:", error);
    return res.status(500).json({
      error: "LinkedIn-like parsing failed.",
      details: error.message,
    });
  }
};

const generateClaimTest = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF file is required." });
    }

    const requestedCompanies = Array.isArray(req.body.companyIds)
      ? req.body.companyIds
      : typeof req.body.companyIds === "string"
        ? req.body.companyIds.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const resumeText = await extractTextFromPdf(req.file.buffer);
    const test = await createResumeClaimTest({ resumeText, requestedCompanies });

    if (mongoose.connection.readyState === 1) {
      await CandidateAssessment.findOneAndUpdate(
        { testId: test.testId },
        {
          testId: test.testId,
          claimedSkills: test.claimedSkills,
          claimStatus: "pending",
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      message: "Resume-based claim verification test generated successfully.",
      availableCompanies: COMPANY_TEMPLATES.map((company) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        role: company.role,
      })),
      ...test,
    });
  } catch (error) {
    console.error("Claim test generation failed:", error);
    return res.status(500).json({
      error: "Claim test generation failed.",
      details: error.message,
    });
  }
};

const submitClaimTest = async (req, res) => {
  try {
    const testId = String(req.body.testId || "").trim();
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const requestedCompanies = Array.isArray(req.body.companyIds)
      ? req.body.companyIds
      : typeof req.body.companyIds === "string"
        ? req.body.companyIds.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    if (!testId) {
      return res.status(400).json({ error: "testId is required." });
    }

    const result = evaluateResumeClaimTest({
      testId,
      answers,
      requestedCompanies,
    });

    if (mongoose.connection.readyState === 1) {
      await CandidateAssessment.findOneAndUpdate(
        { testId },
        {
          authenticityScore: result.authenticityScore,
          claimStatus: result.claimStatus,
          shortlist: result.shortlist,
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      message: "Claim verification completed. Company shortlist generated.",
      ...result,
    });
  } catch (error) {
    console.error("Claim test submission failed:", error);
    return res.status(500).json({
      error: "Claim test submission failed.",
      details: error.message,
    });
  }
};

const startInterviewSimulation = async (req, res) => {
  try {
    const companyId = String(req.body.companyId || "").trim().toLowerCase();
    const resumeSkills = Array.isArray(req.body.resumeSkills) ? req.body.resumeSkills : [];
    const simulation = createInterviewSimulation({ companyId, resumeSkills });
    return res.status(200).json({
      message: "Interview simulation started.",
      availableCompanies: COMPANY_TEMPLATES.map((company) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        role: company.role,
      })),
      ...simulation,
    });
  } catch (error) {
    console.error("Interview simulation start failed:", error);
    return res.status(500).json({
      error: "Interview simulation start failed.",
      details: error.message,
    });
  }
};

const submitInterviewSimulation = async (req, res) => {
  try {
    const sessionId = String(req.body.sessionId || "").trim();
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }
    const result = evaluateInterviewSimulation({ sessionId, answers });
    return res.status(200).json({
      message: "Interview simulation evaluated successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Interview simulation submission failed:", error);
    return res.status(500).json({
      error: "Interview simulation submission failed.",
      details: error.message,
    });
  }
};

const generateProjectPlan = async (req, res) => {
  try {
    const role = String(req.body.role || "").trim() || "Backend Developer";
    const missingSkills = Array.isArray(req.body.missingSkills) ? req.body.missingSkills : [];
    const extractedSkills = Array.isArray(req.body.extractedSkills) ? req.body.extractedSkills : [];
    const blueprint = await generateProjectBlueprintWithAI({
      role,
      missingSkills,
      extractedSkills,
    });
    return res.status(200).json({
      message: "Project blueprint generated successfully.",
      role,
      blueprint,
    });
  } catch (error) {
    console.error("Project blueprint generation failed:", error);
    return res.status(500).json({
      error: "Project blueprint generation failed.",
      details: error.message,
    });
  }
};

module.exports = {
  analyzeResume,
  parseLinkedInProfile,
  generateClaimTest,
  submitClaimTest,
  startInterviewSimulation,
  submitInterviewSimulation,
  generateProjectPlan,
};
