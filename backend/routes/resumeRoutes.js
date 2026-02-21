const express = require("express");

const upload = require("../middleware/uploadMiddleware");
const {
  analyzeResume,
  parseLinkedInProfile,
  generateClaimTest,
  submitClaimTest,
  startInterviewSimulation,
  submitInterviewSimulation,
  generateProjectPlan,
} = require("../controllers/resumeController");

const router = express.Router();

router.post("/analyze-resume", upload.single("resume"), analyzeResume);
router.post("/parse-linkedin-profile", parseLinkedInProfile);
router.post("/generate-claim-test", upload.single("resume"), generateClaimTest);
router.post("/submit-claim-test", submitClaimTest);
router.post("/start-interview-sim", startInterviewSimulation);
router.post("/submit-interview-sim", submitInterviewSimulation);
router.post("/generate-project-plan", generateProjectPlan);

module.exports = router;
