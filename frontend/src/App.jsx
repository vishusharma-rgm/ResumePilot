import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { computeWeightedScore, formatAnalysisDuration } from "./lib/scoring";
import { generateClaimTestApi, submitClaimTestApi } from "./services/api";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

const metrics = [
  {
    title: "ATS Fit Score",
    value: "Instant",
    description: "Quick role readiness check",
  },
  {
    title: "Skill Gap Finder",
    value: "Matched vs Missing",
    description: "See what to add next",
  },
  {
    title: "Action Plan",
    value: "Practical Suggestions",
    description: "Direct improvement points",
  },
];

const ROLE_SKILL_MAP = {
  "Frontend Developer": ["React", "JavaScript", "TypeScript", "CSS", "REST API"],
  "Backend Developer": ["Node", "Express", "MongoDB", "System Design", "SQL"],
  "Data Analyst": ["Python", "SQL", "Statistics", "Excel", "Data Visualization"],
  "Full Stack Developer": ["React", "TypeScript", "Node", "Express", "MongoDB", "SQL", "REST API", "System Design"],
};

const getScoreTextClass = (score, goodThreshold = 49) => (
  Number(score) >= goodThreshold ? "text-emerald-700" : "text-rose-700"
);

const getScoreBarClass = (score, goodThreshold = 49) => (
  Number(score) >= goodThreshold
    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
    : "bg-gradient-to-r from-rose-500 to-red-500"
);

const getInverseScoreTextClass = (score, badThreshold = 49) => (
  Number(score) >= badThreshold ? "text-rose-700" : "text-emerald-700"
);

const getInverseScoreBarClass = (score, badThreshold = 49) => (
  Number(score) >= badThreshold
    ? "bg-gradient-to-r from-rose-500 to-red-500"
    : "bg-gradient-to-r from-emerald-500 to-teal-500"
);

const ANALYSIS_RESULT_KEY = "resume_analysis_result";
const ANALYSIS_FALLBACK_KEY = "resume_analysis_fallback";
const ANALYSIS_DURATION_KEY = "resume_last_analysis_duration_ms";
const ANALYSIS_META_KEY = "resume_last_analysis_meta";
const ANALYSIS_HISTORY_KEY = "resume_analysis_history";
const SELECTED_ROLE_KEY = "resume_selected_role";
const THEME_KEY = "resume_theme";
const JD_DETECTED_KEY = "resume_jd_detected";
const CLAIM_RESULT_KEY = "resume_claim_result";
const INTERVIEW_RESULT_KEY = "resume_interview_result";
const ThemeContext = createContext({ isDark: false, setIsDark: () => {}, toggleTheme: () => {} });
let SESSION_UPLOADED_RESUME_FILE = null;
let SESSION_UPLOADED_RESUME_NAME = "";

const clearSessionDataOnLoad = () => {
  try {
    localStorage.removeItem(ANALYSIS_RESULT_KEY);
    localStorage.removeItem(ANALYSIS_FALLBACK_KEY);
    localStorage.removeItem(ANALYSIS_DURATION_KEY);
    localStorage.removeItem(ANALYSIS_META_KEY);
    localStorage.removeItem(ANALYSIS_HISTORY_KEY);
    localStorage.removeItem(SELECTED_ROLE_KEY);
    localStorage.removeItem(JD_DETECTED_KEY);
    localStorage.removeItem(CLAIM_RESULT_KEY);
    localStorage.removeItem(INTERVIEW_RESULT_KEY);
    localStorage.removeItem("resume_demo_mode");
  } catch (_error) {
    // no-op
  }
  SESSION_UPLOADED_RESUME_FILE = null;
  SESSION_UPLOADED_RESUME_NAME = "";
};

clearSessionDataOnLoad();

const appState = {
  getAnalysisResult() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANALYSIS_RESULT_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  },
  setAnalysisResult(value) {
    localStorage.setItem(ANALYSIS_RESULT_KEY, JSON.stringify(value));
  },
  clearAnalysisResult() {
    localStorage.removeItem(ANALYSIS_RESULT_KEY);
  },
  setFallbackResult(value) {
    localStorage.setItem(ANALYSIS_FALLBACK_KEY, JSON.stringify(value));
  },
  getFallbackResult() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANALYSIS_FALLBACK_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  },
  clearFallbackResult() {
    localStorage.removeItem(ANALYSIS_FALLBACK_KEY);
  },
  getSelectedRole() {
    try {
      return localStorage.getItem(SELECTED_ROLE_KEY) || "";
    } catch (_error) {
      return "";
    }
  },
  setSelectedRole(value) {
    localStorage.setItem(SELECTED_ROLE_KEY, value);
  },
  setAnalysisMeta(meta) {
    localStorage.setItem(ANALYSIS_META_KEY, JSON.stringify(meta));
    if (Number.isFinite(meta?.durationMs)) {
      localStorage.setItem(ANALYSIS_DURATION_KEY, String(meta.durationMs));
    }
  },
  getAnalysisMeta() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANALYSIS_META_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  },
  pushAnalysisHistory(entry) {
    try {
      const existing = JSON.parse(localStorage.getItem(ANALYSIS_HISTORY_KEY) || "[]");
      const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-12);
      localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(next));
    } catch (_error) {
      // no-op
    }
  },
  getAnalysisHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANALYSIS_HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  },
  getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch (_error) {
      return false;
    }
  },
  setTheme(isDark) {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  },
  setJdDetected(flag) {
    localStorage.setItem(JD_DETECTED_KEY, flag ? "true" : "false");
  },
  isJdDetected() {
    return localStorage.getItem(JD_DETECTED_KEY) === "true";
  },
  getClaimResult() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLAIM_RESULT_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  },
  setClaimResult(value) {
    localStorage.setItem(CLAIM_RESULT_KEY, JSON.stringify(value));
  },
  clearClaimResult() {
    localStorage.removeItem(CLAIM_RESULT_KEY);
  },
  getInterviewResult() {
    try {
      const parsed = JSON.parse(localStorage.getItem(INTERVIEW_RESULT_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  },
  setInterviewResult(value) {
    localStorage.setItem(INTERVIEW_RESULT_KEY, JSON.stringify(value));
  },
  clearInterviewResult() {
    localStorage.removeItem(INTERVIEW_RESULT_KEY);
  },
};

const getStoredAnalysisResult = () => {
  return appState.getAnalysisResult();
};

const clearStoredAnalysisResult = () => {
  try {
    appState.clearAnalysisResult();
    appState.clearClaimResult();
    appState.clearInterviewResult();
  } catch (_error) {
    // no-op
  }
};

const exportJsonFile = (fileName, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getDemoAnalysisResult = () => ({
  score: 74,
  extractedSkills: ["React", "Node", "JavaScript", "Git", "REST API"],
  matchedSkills: ["Node", "REST API"],
  missingSkills: ["MongoDB", "System Design", "SQL"],
  suggestions:
    "Add one backend project with database scaling, indexing, and architecture decisions.",
});

const setDemoMode = (enabled) => {
  try {
    localStorage.setItem("resume_demo_mode", enabled ? "true" : "false");
  } catch (_error) {
    // no-op
  }
};

const isDemoModeActive = () => {
  try {
    return localStorage.getItem("resume_demo_mode") === "true";
  } catch (_error) {
    return false;
  }
};

function LiquidNavbar() {
  return (
    <div className="sticky top-4 z-50 px-4">
      <nav className="liquid-nav mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <span className="liquid-shine" />
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-900">
          ResumePilot
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
          <a href="#overview" className="hover:text-[var(--primary)]">Overview</a>
          <a href="#highlights" className="hover:text-[var(--primary)]">Highlights</a>
          <Link to="/analyze" className="hover:text-[var(--primary)]">Analyze</Link>
        </div>
        <Link
          to="/analyze"
          onClick={clearStoredAnalysisResult}
          className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:bg-[var(--primary-dark)] hover:shadow-lg hover:shadow-teal-200/80"
        >
          Start Now
        </Link>
      </nav>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const howSectionRef = useRef(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const stickyStateRef = useRef(false);
  const { scrollYProgress } = useScroll({
    target: howSectionRef,
    offset: ["start end", "end start"],
  });
  const progressHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const shouldShow = latest > 0.12;
    if (stickyStateRef.current !== shouldShow) {
      stickyStateRef.current = shouldShow;
      setShowStickyCta(shouldShow);
    }
  });
  const runLandingDemo = () => {
    const demo = getDemoAnalysisResult();
    appState.setAnalysisResult(demo);
    appState.setSelectedRole("Backend Developer");
    appState.setAnalysisMeta({
      source: "demo",
      analyzedAt: new Date().toISOString(),
      durationMs: 0,
    });
    appState.pushAnalysisHistory({
      role: "Backend Developer",
      score: demo.score || 0,
      source: "demo",
      at: new Date().toISOString(),
    });
    setDemoMode(true);
    navigate("/role-match");
  };

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[#111111] text-white md:snap-y md:snap-mandatory [background:radial-gradient(circle_at_50%_-12%,#2f2f2f_0%,#171717_42%,#111111_70%)]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.07),transparent_28%),radial-gradient(circle_at_52%_84%,rgba(20,184,166,0.07),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.08] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:44px_44px]" />
      {showStickyCta ? (
        <Link
          to="/analyze"
          onClick={clearStoredAnalysisResult}
          className="fixed right-6 top-5 z-50 rounded-xl bg-[#f5f5f4] px-4 py-2 text-sm font-semibold text-[#111827] shadow-lg transition hover:bg-[#e7e5e4]"
        >
          Analyze Now
        </Link>
      ) : null}
      <main className="relative z-10 w-full pb-0 pt-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute left-6 top-6 z-30 flex items-center gap-2"
        >
          <span className="inline-flex h-6 w-5 items-center justify-center rounded-sm border border-stone-400/80 bg-stone-100 text-[10px] font-bold text-stone-900 shadow-sm">
            ▤
          </span>
          <span className="block text-lg font-semibold tracking-tight text-white md:text-xl">ResumePilot</span>
        </motion.div>
        <motion.nav
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="premium-nav hidden items-center justify-center gap-16 text-base font-semibold text-stone-100 md:flex md:text-lg"
        >
          <a href="#how">How It Works</a>
          <a href="#what-you-get">What You Get</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </motion.nav>
        <section className="relative mx-auto mt-0 flex min-h-screen max-w-5xl snap-start items-center px-6 text-center">
          <div className="w-full">
          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="landing-hero-title-v2 mx-auto max-w-4xl text-5xl font-bold leading-[1.02] tracking-[-0.02em] md:text-7xl"
          >
            <span className="block text-white">Get More Interviews</span>
            <span className="landing-hero-typewriter-wrap mt-2 block">
              <span className="landing-hero-typewriter">
                <span className="landing-hero-type-white">with a </span>
                <span className="landing-hero-type-green">Better</span>
                <span className="landing-hero-type-white"> Resume.</span>
              </span>
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="landing-hero-subtitle-v2 mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-stone-300 md:text-[20px] md:leading-[1.42]"
          >
            Optimize your resume with real-time ATS scores, skill match, and expert AI recommendations.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/analyze"
              onClick={clearStoredAnalysisResult}
              className="inline-flex items-center gap-2 rounded-xl bg-[#f5f5f4] px-8 py-3 text-base font-semibold text-[#111827] shadow-[0_12px_30px_rgba(255,255,255,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e7e5e4] hover:shadow-[0_16px_36px_rgba(255,255,255,0.26)] md:px-10 md:py-4 md:text-lg"
            >
              Analyze My Resume <span aria-hidden>→</span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-600/90 bg-stone-900/65 px-8 py-3 text-base font-semibold text-stone-200 transition-all duration-200 hover:border-stone-400 hover:bg-stone-800/75 hover:text-white md:px-10 md:py-4 md:text-lg"
            >
              View Workflow
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="relative left-1/2 mt-10 w-screen -translate-x-1/2 overflow-hidden"
          >
            <div className="relative overflow-hidden border-y border-stone-700/70 bg-gradient-to-r from-[#0b0b0c] via-[#111112] to-[#0b0b0c] py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.35)]">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-black/55 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-black/55 to-transparent" />
              <motion.div
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="flex w-[200%] items-center gap-16 whitespace-nowrap"
              >
                {Array.from({ length: 2 }).map((_, setIdx) => (
                  <div key={`set-${setIdx}`} className="flex items-center gap-16 pr-16">
                    {[
                      "ATS CHECKER",
                      "ROLE MATCH",
                      "MISSING SKILLS",
                      "INTERVIEW SIM",
                      "PROJECT PLAN",
                      "READINESS SCORE",
                      "APPLICATION READINESS",
                      "INTERVIEW LOOP",
                    ].map((label, idx) => (
                      <div key={`${setIdx}-${label}`} className="flex items-center gap-16">
                        <span className="text-[13px] font-bold tracking-[0.2em] text-[#d6d0c4] md:text-lg">
                          {label}
                        </span>
                        {idx < 7 ? <span className="text-stone-500">◆</span> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
          </div>
        </section>

        <section id="how" ref={howSectionRef} className="landing-section relative min-h-screen w-full snap-start overflow-hidden">
          <motion.div style={{ y: bgY }} className="landing-ambient pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 md:px-10 md:py-16">
            <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center"
            >
              <p className="premium-kicker inline-flex rounded-full border border-emerald-400/45 bg-slate-500/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                How It Works
              </p>
              <h2 className="premium-section-title mt-3 text-3xl font-bold tracking-tight text-white md:text-6xl">From Upload to Interview-Ready</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-stone-300 md:text-lg">
                Scroll down and follow the exact workflow we use to turn a basic resume into a shortlist-ready profile.
              </p>
            </motion.div>

            <div className="relative mt-12 md:mt-16">
              <div className="absolute left-[17px] top-0 h-full w-[2px] rounded-full bg-stone-800 md:left-1/2 md:-ml-[1px]" />
              <motion.div style={{ height: progressHeight }} className="absolute left-[17px] top-0 w-[2px] rounded-full bg-emerald-400 md:left-1/2 md:-ml-[1px]" />

              <div className="space-y-7 md:space-y-10">
                {[
                  { step: "01", title: "Upload Resume", desc: "Drop your resume. We instantly parse sections, projects, and skill claims." },
                  { step: "02", title: "Run ATS + Match Scan", desc: "Get ATS score, role alignment, and missing keyword insights in one pass." },
                  { step: "03", title: "Apply Priority Fixes", desc: "Use targeted AI recommendations to improve relevance and interview chances." },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5, delay: index * 0.06 }}
                    className={`relative flex items-start gap-4 md:gap-6 ${index % 2 === 0 ? "md:justify-start" : "md:justify-end"}`}
                  >
                    <span className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-[#0f1613] text-xs font-bold text-emerald-300 md:absolute md:left-1/2 md:top-6 md:-ml-[18px]">
                      {item.step}
                    </span>
                    <div className={`ml-0 w-full rounded-2xl border border-stone-700/80 bg-stone-900/70 p-5 backdrop-blur md:w-[44%] ${index % 2 === 0 ? "md:mr-auto md:ml-0" : "md:ml-auto md:mr-0"}`}>
                      <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-base leading-relaxed text-stone-300">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section relative min-h-screen w-full snap-start overflow-hidden">
          <div className="landing-ambient absolute inset-0" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
            <div className="w-full">
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="premium-kicker inline-flex rounded-full border border-emerald-400/45 bg-slate-500/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300"
              >
                Features
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
                className="premium-section-title mt-3 max-w-4xl text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl"
              >
                Built to improve shortlist chances, not just look good.
              </motion.h2>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {[
                  { title: "Section-Level Resume Scan", desc: "Analyze summary, experience, projects, and skills with focused ATS-readability checks." },
                  { title: "Role Alignment Engine", desc: "Compare your profile against target role expectations and expose high-impact mismatches." },
                  { title: "Missing Keyword Detection", desc: "Find absent domain terms and recruiter-relevant phrases that affect filtering." },
                  { title: "Actionable Rewrite Guidance", desc: "Get concrete suggestion lines you can directly apply to improve clarity and impact." },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: index * 0.05 }}
                    className="rounded-2xl border border-stone-700/75 bg-stone-900/60 p-5"
                  >
                    <p className="text-2xl font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-base leading-relaxed text-stone-300">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="what-you-get" className="landing-section relative min-h-screen w-full snap-start overflow-hidden">
          <div className="landing-ambient absolute inset-0" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
            <div className="w-full">
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="premium-kicker inline-flex rounded-full border border-emerald-400/45 bg-slate-500/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300"
              >
                What You Get
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
                className="premium-section-title mt-3 max-w-4xl text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl"
              >
                Everything you need to improve your resume with clarity.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.06 }}
                className="mt-4 max-w-3xl text-base leading-relaxed text-stone-300 md:text-lg"
              >
                Get a complete analysis pipeline: score diagnostics, role fit clarity, and practical edits that improve shortlist potential.
              </motion.p>

              <div className="mt-10 space-y-3">
                {[
                  {
                    title: "ATS Score Breakdown",
                    desc: "Section-wise readability, structure flags, and keyword fit insights so you know what blocks screening.",
                    meta: "Format + Keywords",
                  },
                  {
                    title: "Skill Gap Mapping",
                    desc: "Clear matched vs missing skills against your target role with focus on high-impact gaps first.",
                    meta: "Role-Specific",
                  },
                  {
                    title: "AI Action Plan",
                    desc: "Priority recommendations with concrete bullet-level changes you can apply right away.",
                    meta: "Actionable Fixes",
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: index * 0.05 }}
                    className="relative overflow-hidden border border-stone-700/75 bg-stone-900/60 px-5 py-5 md:px-6"
                  >
                    <span className="absolute inset-y-0 left-0 w-1.5 bg-emerald-400/80" />
                    <div className="pl-3 md:flex md:items-start md:justify-between md:gap-8">
                      <div className="md:max-w-[68%]">
                        <p className="text-2xl font-semibold text-white md:text-3xl">{item.title}</p>
                        <p className="mt-1 text-base leading-relaxed text-stone-300 md:text-lg">{item.desc}</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300 md:mt-1 md:text-sm">
                        {item.meta}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: 0.15 }}
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-stone-600/80 bg-stone-900/60 px-4 py-1.5 text-sm font-semibold text-stone-200"
              >
                Output includes score summary, missing keywords, and prioritized recommendations.
              </motion.div>
            </div>
          </div>
        </section>

        <section className="landing-section relative w-full snap-start overflow-hidden">
          <div className="landing-ambient absolute inset-0" />
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 py-14 md:px-10">
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="premium-kicker inline-flex rounded-full border border-emerald-400/45 bg-slate-500/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300"
            >
              Problem to Overcome
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="premium-section-title mt-3 max-w-4xl text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl"
            >
              Turn unclear resumes into interview-ready profiles.
            </motion.h2>

            <div className="mt-10 space-y-5 md:space-y-6">
              {[
                {
                  title: "Problem",
                  text: "Applications get ignored because the resume lacks ATS keywords, clear impact, and role alignment.",
                },
                {
                  title: "Optimization",
                  text: "ResumePilot scans structure and skill gaps, then gives prioritized fixes that improve relevance fast.",
                },
                {
                  title: "Outcome",
                  text: "You apply with a stronger resume that reads clearly to recruiters and performs better in shortlisting.",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.5, delay: index * 0.06 }}
                  className="relative overflow-hidden border border-stone-700/70 bg-stone-900/55 px-5 py-6 md:px-7"
                >
                  <span className="absolute inset-y-0 left-0 w-1.5 bg-emerald-400/85" />
                  <p className="premium-kicker-strong pl-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">{item.title}</p>
                  <p className="mt-2 max-w-4xl pl-2 text-base leading-relaxed text-stone-200 md:text-xl md:leading-[1.45]">{item.text}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-12"
            >
              <Link
                to="/analyze"
                onClick={clearStoredAnalysisResult}
                className="inline-flex items-center gap-2 rounded-full border border-stone-600 bg-stone-900/70 px-5 py-2 text-sm font-semibold text-white transition hover:border-emerald-400 hover:text-emerald-300 md:text-base"
              >
                Start your resume transformation →
              </Link>
            </motion.div>
          </div>
        </section>

        <section id="faq" className="landing-section relative h-screen w-full snap-start overflow-hidden">
          <div className="landing-ambient absolute inset-0" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
            <div className="w-full">
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="premium-kicker inline-flex rounded-full border border-emerald-400/45 bg-slate-500/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300"
              >
                FAQ
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
                className="premium-section-title mt-3 max-w-4xl text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl"
              >
                Common questions, clear answers.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.06 }}
                className="mt-4 max-w-3xl text-base leading-relaxed text-stone-300 md:text-lg"
              >
                Everything you need to know before uploading your resume and starting analysis.
              </motion.p>
              <div className="mt-10 space-y-3">
                {[
                  {
                    q: "Do I need to sign up first?",
                    a: "No. You can upload and run analysis directly, then decide if you want to continue with deeper workflow features.",
                  },
                  {
                    q: "Which roles are supported?",
                    a: "Core workflows are available for Frontend, Backend, Data Analyst, and Full-Stack profiles with role-specific skill checks.",
                  },
                  {
                    q: "How long does analysis take?",
                    a: "Most resumes complete in under a minute. Larger files with dense project history can take slightly longer.",
                  },
                  {
                    q: "What kind of output do I get?",
                    a: "You get ATS score context, skill-gap mapping, and prioritized AI recommendations you can apply immediately.",
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.q}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="rounded-xl border border-stone-700/75 bg-stone-900/60 px-5 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.25)]"
                  >
                    <p className="text-lg font-semibold text-white">{item.q}</p>
                    <p className="mt-1 text-base leading-relaxed text-stone-300">{item.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function AnalyzePage() {
  const location = useLocation();
  const ANALYSIS_STEPS = ["Uploading resume", "Processing content", "Scanning skills"];
  const ANALYSIS_STEP_META = [
    { key: "upload", label: "Upload", glyph: "↑" },
    { key: "process", label: "Process", glyph: "◌" },
    { key: "scan", label: "Scan", glyph: "◎" },
  ];
  const COMPANY_SHORTLIST_TEMPLATES = [
    { companyId: "code-orbit", companyName: "CodeOrbit", role: "Backend Developer", requiredSkills: ["Node", "Express", "MongoDB", "SQL", "System Design"] },
    { companyId: "pixel-forge", companyName: "PixelForge", role: "Frontend Developer", requiredSkills: ["React", "JavaScript", "TypeScript", "CSS", "REST API"] },
    { companyId: "data-sphere", companyName: "DataSphere", role: "Data Analyst", requiredSkills: ["Python", "SQL", "Statistics", "Excel"] },
  ];
  const normalizeSkill = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").replace(/\s+/g, " ").trim();
  const buildTestBasedShortlist = ({ claimedSkills = [], skillBreakdown = [] }) => {
    if (!Array.isArray(skillBreakdown) || skillBreakdown.length === 0) {
      return [];
    }
    const claimSet = new Set((claimedSkills || []).map(normalizeSkill));
    const scoreBySkill = Object.fromEntries(
      (skillBreakdown || []).map((item) => [normalizeSkill(item.skill), Number(item.score || 0)])
    );

    return COMPANY_SHORTLIST_TEMPLATES.map((company) => {
      const normalizedRequired = company.requiredSkills.map(normalizeSkill);
      const matchedSkills = normalizedRequired.filter((skill) => claimSet.has(skill));
      if (matchedSkills.length === 0) {
        return null;
      }
      const testScore = Math.round(
        matchedSkills.reduce((sum, skill) => sum + Number(scoreBySkill[skill] || 0), 0) / matchedSkills.length
      );
      const claimCoverage = Math.round((matchedSkills.length / normalizedRequired.length) * 100);
      return {
        companyId: company.companyId,
        companyName: company.companyName,
        role: company.role,
        fitScore: testScore,
        testScore,
        claimCoverage,
      };
    }).filter(Boolean).sort((a, b) => b.fitScore - a.fitScore);
  };
  const normalizeClaimResult = (result, claimedSkills = []) => {
    const shortlistFromResult = Array.isArray(result?.shortlist) ? result.shortlist : [];
    const cleaned = shortlistFromResult
      .filter((item) => Number(item?.claimCoverage || 0) > 0)
      .map((item) => ({
        ...item,
        fitScore: Number.isFinite(Number(item?.testScore)) ? Math.round(Number(item.testScore)) : Math.round(Number(item?.fitScore || 0)),
      }))
      .sort((a, b) => b.fitScore - a.fitScore);
    if (cleaned.length > 0) {
      return {
        ...result,
        shortlist: cleaned,
      };
    }

    return {
      ...result,
      shortlist: buildTestBasedShortlist({
        claimedSkills,
        skillBreakdown: Array.isArray(result?.skillBreakdown) ? result.skillBreakdown : [],
      }),
    };
  };

  const [fileName, setFileName] = useState(() => SESSION_UPLOADED_RESUME_NAME);
  const [selectedFile, setSelectedFile] = useState(() => SESSION_UPLOADED_RESUME_FILE);
  const [selectedDomain, setSelectedDomain] = useState(() => {
    return appState.getSelectedRole();
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [claimTest, setClaimTest] = useState(null);
  const [claimAnswers, setClaimAnswers] = useState({});
  const [claimResult, setClaimResult] = useState(null);
  const [isGeneratingClaimTest, setIsGeneratingClaimTest] = useState(false);
  const [isSubmittingClaimTest, setIsSubmittingClaimTest] = useState(false);
  const [claimError, setClaimError] = useState("");
  const claimResultRef = useRef(null);
  const claimQuestionsRef = useRef(null);
  const resumeUploadRef = useRef(null);
  const analysisResultRef = useRef(null);
  const resumeFileInputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const storedResult = getStoredAnalysisResult();
  const activeResult = isAnalyzing ? null : (analysisResult || storedResult);
  const hasAnalysis = Boolean(activeResult);
  const selectedRole = selectedDomain || "Backend Developer";
  const activeResumeFile = selectedFile || SESSION_UPLOADED_RESUME_FILE;
  const requiredSkills = ROLE_SKILL_MAP[selectedRole] || [];
  const extractedSkills = activeResult?.extractedSkills || [];
  const extractedSet = new Set(extractedSkills.map((skill) => String(skill).toLowerCase()));
  const roleMatchedSkills = requiredSkills.filter((skill) => extractedSet.has(skill.toLowerCase()));
  const roleMissingSkills = requiredSkills.filter((skill) => !extractedSet.has(skill.toLowerCase()));
  const topMissingSkill = hasAnalysis ? (roleMissingSkills[0] || "None") : "None";
  const previousScore = (() => {
    const history = appState.getAnalysisHistory();
    if (history.length < 2) return null;
    return Number(history[history.length - 2]?.score || 0);
  })();
  const scoreDelta = hasAnalysis && previousScore !== null
    ? (Number(activeResult?.score || 0) - previousScore)
    : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  const handleResumeFileSelect = (file) => {
    const nextFile = file || null;
    const isPdfByType = nextFile?.type === "application/pdf";
    const isPdfByName = /\.pdf$/i.test(nextFile?.name || "");
    const looksLikeResumeName = /(resume|cv|curriculum|biodata|profile)/i.test(nextFile?.name || "");
    if (nextFile && !isPdfByType && !isPdfByName) {
      setErrorMessage("No resume found. Please upload your resume in PDF format.");
      setSelectedFile(null);
      setFileName("");
      SESSION_UPLOADED_RESUME_FILE = null;
      SESSION_UPLOADED_RESUME_NAME = "";
      return;
    }
    if (nextFile && !looksLikeResumeName) {
      setErrorMessage("No resume found. Please upload a valid resume PDF (example: resume.pdf).");
      setSelectedFile(null);
      setFileName("");
      SESSION_UPLOADED_RESUME_FILE = null;
      SESSION_UPLOADED_RESUME_NAME = "";
      return;
    }
    setSelectedFile(nextFile);
    setFileName(nextFile?.name || "");
    SESSION_UPLOADED_RESUME_FILE = nextFile;
    SESSION_UPLOADED_RESUME_NAME = nextFile?.name || "";
    setErrorMessage("");
  };

  const handleDropzoneDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDropzoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDropzoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    handleResumeFileSelect(event.dataTransfer?.files?.[0] || null);
  };

  const buildLocalFallback = () => {
    const fallbackExtractedByRole = {
      "Frontend Developer": ["React", "JavaScript", "CSS", "Git"],
      "Backend Developer": ["Node", "Express", "REST API", "Git"],
      "Data Analyst": ["Python", "SQL", "Excel", "Data Visualization"],
      "Full Stack Developer": ["React", "Node", "JavaScript", "REST API", "Git"],
    };
    const required = ROLE_SKILL_MAP[selectedRole] || [];
    const extracted = fallbackExtractedByRole[selectedRole] || [];
    const fallbackSet = new Set(extracted.map((skill) => skill.toLowerCase()));
    const matched = required.filter((skill) => fallbackSet.has(skill.toLowerCase()));
    const missing = required.filter((skill) => !fallbackSet.has(skill.toLowerCase()));
    const score = required.length ? Math.round((matched.length / required.length) * 100) : 0;

    return {
      score,
      extractedSkills: extracted,
      matchedSkills: matched,
      missingSkills: missing,
      suggestions: `Fallback mode: add ${missing.slice(0, 2).join(" and ") || "core domain"} depth to improve ${selectedRole} fit.`,
    };
  };

  const normalizeAnalysisPayload = (payload) => {
    const required = ROLE_SKILL_MAP[selectedRole] || [];
    const rawExtracted = Array.isArray(payload?.extractedSkills)
      ? payload.extractedSkills
      : Array.isArray(payload?.skills)
        ? payload.skills
        : Array.isArray(payload?.keywords)
          ? payload.keywords
          : [];
    const rawMatched = Array.isArray(payload?.matchedSkills) ? payload.matchedSkills : [];
    const extracted = [...new Set([...rawExtracted, ...rawMatched].map((skill) => String(skill).trim()).filter(Boolean))];
    const extractedLookup = new Set(extracted.map((skill) => skill.toLowerCase()));
    const matched = required.length
      ? required.filter((skill) => extractedLookup.has(skill.toLowerCase()))
      : rawMatched;
    const missing = required.length
      ? required.filter((skill) => !extractedLookup.has(skill.toLowerCase()))
      : (Array.isArray(payload?.missingSkills) ? payload.missingSkills : []);
    const score = typeof payload?.score === "number"
      ? payload.score
      : required.length
        ? Math.round((matched.length / required.length) * 100)
        : 0;

    return {
      ...payload,
      score,
      extractedSkills: extracted,
      matchedSkills: matched,
      missingSkills: missing,
    };
  };

  const handleAnalyze = async () => {
    if (!selectedDomain) {
      setErrorMessage("Please select a domain first (Frontend / Backend / Data Analyst).");
      return;
    }

    if (!activeResumeFile) {
      setErrorMessage("Please upload a PDF resume first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisPhase(0);
    setErrorMessage("");
    setAnalysisResult(null);
    const startedAt = Date.now();
    const preAnalyzeMs = 2600 + Math.floor(Math.random() * 1800);
    const phaseIntervalId = window.setInterval(() => {
      setAnalysisPhase((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, Math.max(700, Math.floor(preAnalyzeMs / ANALYSIS_STEPS.length)));
    await new Promise((resolve) => setTimeout(resolve, preAnalyzeMs));
    window.clearInterval(phaseIntervalId);
    setAnalysisPhase(ANALYSIS_STEPS.length - 1);

    try {
      const formData = new FormData();
      formData.append("resume", activeResumeFile);
      appState.setSelectedRole(selectedDomain);
      const selectedRequiredSkills = ROLE_SKILL_MAP[selectedDomain] || [];
      formData.append("requiredSkills", selectedRequiredSkills.join(","));

      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        body: formData,
      });

      const rawBody = await response.text();
      let data = {};
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch (_error) {
          throw new Error("Server returned invalid response format.");
        }
      }

      if (!response.ok) {
        if (response.status === 403) {
          const fallback = buildLocalFallback();
          setAnalysisResult(fallback);
          appState.setAnalysisResult(fallback);
          appState.setFallbackResult(fallback);
          appState.setAnalysisMeta({
            source: "fallback",
            analyzedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          });
          appState.pushAnalysisHistory({
            role: selectedDomain,
            score: fallback.score || 0,
            source: "fallback",
            at: new Date().toISOString(),
          });
          setErrorMessage("");
          return;
        }
        throw new Error(
          data.error ||
          data.details ||
          `Analysis failed with status ${response.status}.`
        );
      }

      if (!data || typeof data !== "object") {
        throw new Error("Server returned an empty response.");
      }

      const normalized = normalizeAnalysisPayload(data);
      setAnalysisResult(normalized);
      appState.setAnalysisResult(normalized);
      appState.clearFallbackResult();
      appState.setAnalysisMeta({
        source: "api",
        analyzedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
      appState.pushAnalysisHistory({
        role: selectedDomain,
        score: normalized.score || 0,
        source: "api",
        at: new Date().toISOString(),
      });
    } catch (_error) {
      const fallback = buildLocalFallback();
      setAnalysisResult(fallback);
      appState.setAnalysisResult(fallback);
      appState.setFallbackResult(fallback);
      appState.setAnalysisMeta({
        source: "fallback",
        analyzedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
      appState.pushAnalysisHistory({
        role: selectedDomain,
        score: fallback.score || 0,
        source: "fallback",
        at: new Date().toISOString(),
      });
      setErrorMessage("");
    } finally {
      setAnalysisPhase(0);
      setIsAnalyzing(false);
      window.setTimeout(() => {
        analysisResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
    }
  };

  const handleGenerateClaimTest = async () => {
    if (!activeResumeFile) {
      setClaimError("Upload a resume to generate the claim verification test.");
      window.alert("Please upload your resume first.");
      if (resumeUploadRef.current) {
        resumeUploadRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsGeneratingClaimTest(true);
    setClaimError("");
    setClaimResult(null);

    try {
      const data = await generateClaimTestApi({ file: activeResumeFile });
      setClaimTest(data);
      setClaimAnswers({});
    } catch (error) {
      const fallbackSkills = [
        ...(activeResult?.extractedSkills || []),
        ...(ROLE_SKILL_MAP[selectedRole] || []),
      ].filter((skill, idx, arr) => arr.indexOf(skill) === idx).slice(0, 5);
      if (fallbackSkills.length > 0) {
        const localQuestions = fallbackSkills.flatMap((skill, idx) => ([
          {
            id: `local_${idx}_1`,
            skill,
            type: "mcq",
            prompt: `Which statement best reflects a practical use of ${skill}?`,
            options: [
              `Using ${skill} in production to solve problems with measurable impact`,
              `${skill} is only theoretical and not used in real projects`,
              `${skill} is not useful in team-based engineering work`,
              `${skill} is unrelated to software or product delivery`,
            ],
            weight: 50,
          },
          {
            id: `local_${idx}_2`,
            skill,
            type: "mcq",
            prompt: `If ${skill} is listed in a resume, which signal shows strong proficiency?`,
            options: [
              "Can explain tradeoffs, debug issues, and deliver features independently",
              "Has only heard the term and never used it in practice",
              "Copies sample code without understanding implementation details",
              `Avoids tasks related to ${skill}`,
            ],
            weight: 50,
          },
        ]));
        setClaimTest({
          testId: `practice_test_${Date.now()}`,
          claimedSkills: fallbackSkills,
          questions: localQuestions,
          questionCount: localQuestions.length,
        });
        setClaimAnswers({});
        setClaimError("");
      } else {
        setClaimError(error.message || "Claim test generation failed.");
      }
    } finally {
      setIsGeneratingClaimTest(false);
    }
  };

  const handleSelectAnswer = (questionId, selectedOption) => {
    setClaimAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOption,
    }));
  };

  const handleSubmitClaimTest = async () => {
    if (!claimTest?.testId) {
      setClaimError("Generate the claim test before submitting.");
      return;
    }

    const answers = (claimTest.questions || []).map((question) => ({
      questionId: question.id,
      selectedOption: Number.isInteger(claimAnswers[question.id]) ? claimAnswers[question.id] : -1,
    }));

    if (String(claimTest.testId).startsWith("practice_test_")) {
      const grouped = (claimTest.questions || []).reduce((acc, question) => {
        const selectedOption = claimAnswers[question.id];
        const isAnswered = Number.isInteger(selectedOption) && selectedOption >= 0;
        if (!isAnswered) {
          return acc;
        }
        const key = question.skill;
        if (!acc[key]) acc[key] = { correct: 0, total: 0 };
        acc[key].total += 1;
        if (selectedOption === 0) acc[key].correct += 1;
        return acc;
      }, {});

      const skillBreakdown = Object.entries(grouped).map(([skill, value]) => ({
        skill,
        score: value.total ? Math.round((value.correct / value.total) * 100) : 0,
      }));
      const authenticityScore = skillBreakdown.length
        ? Math.round(skillBreakdown.reduce((sum, item) => sum + item.score, 0) / skillBreakdown.length)
        : 0;
      const claimStatus = skillBreakdown.length === 0
        ? "not_attempted"
        : authenticityScore >= 75
          ? "strongly_verified"
          : authenticityScore >= 50
            ? "partially_verified"
            : "weakly_verified";

      const shortlist = buildTestBasedShortlist({
        claimedSkills: claimTest.claimedSkills || [],
        skillBreakdown,
      });

      const normalizedClaim = normalizeClaimResult({
        testId: claimTest.testId,
        claimStatus,
        authenticityScore,
        skillBreakdown,
        shortlist,
      }, claimTest.claimedSkills || []);
      setClaimResult(normalizedClaim);
      appState.setClaimResult(normalizedClaim);
      return;
    }

    setIsSubmittingClaimTest(true);
    setClaimError("");
    try {
      const data = await submitClaimTestApi({
        testId: claimTest.testId,
        answers,
      });
      const normalizedClaim = normalizeClaimResult(data, claimTest.claimedSkills || []);
      setClaimResult(normalizedClaim);
      appState.setClaimResult(normalizedClaim);
    } catch (error) {
      setClaimError(error.message || "Claim test submission failed.");
    } finally {
      setIsSubmittingClaimTest(false);
    }
  };

  const analysisTimeLabel = useMemo(() => {
    if (!hasAnalysis) return "0s";
    try {
      const storedMs = Number(localStorage.getItem(ANALYSIS_DURATION_KEY) || "0");
      return formatAnalysisDuration(storedMs);
    } catch (_error) {
      return "N/A";
    }
  }, [hasAnalysis, activeResult]);
  const analysisMeta = appState.getAnalysisMeta();
  const claimQuestionGroups = useMemo(() => {
    const map = new Map();
    for (const question of claimTest?.questions || []) {
      const key = question.skill || "General";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(question);
    }
    return Array.from(map.entries()).map(([skill, questions]) => ({ skill, questions }));
  }, [claimTest]);
  const claimStatusLabel = String(claimResult?.claimStatus || "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  useEffect(() => {
    if (claimResult && claimResultRef.current) {
      claimResultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [claimResult]);

  useEffect(() => {
    if (claimTest?.questions?.length && claimQuestionsRef.current) {
      claimQuestionsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [claimTest]);

  useEffect(() => {
    if (location.hash === "#verification-test") {
      const section = document.getElementById("verification-test");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [location.hash]);

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen overflow-x-hidden px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
        <WorkspaceTopbar />
        <PageExportActions className="mb-4" />
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold"
        >
          Resume Analyzer
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-2 text-[var(--muted)]"
        >
          Upload your resume and preview realistic AI analysis behavior.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="editorial-strip mt-6 rounded-2xl border border-teal-100 p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Select Domain (Required)</p>
          </div>
          <p className="text-xs text-slate-600">Select your domain</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {Object.keys(ROLE_SKILL_MAP).map((role) => (
              <button
                key={role}
                onClick={() => {
                  setSelectedDomain(role);
                  appState.setSelectedRole(role);
                  setErrorMessage("");
                }}
                className={`group rounded-xl border px-4 py-3 text-left transition-all ${
                  selectedDomain === role
                    ? "border-teal-300 bg-teal-50 shadow-md ring-2 ring-teal-200"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{role}</p>
                  {selectedDomain === role ? (
                    <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {role === "Frontend Developer"
                    ? "UI, React, TypeScript focused"
                    : role === "Backend Developer"
                      ? "APIs, DB, system design focused"
                      : role === "Data Analyst"
                        ? "SQL, stats, analytics focused"
                        : "Frontend + Backend end-to-end"}
                </p>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.14 }}
          ref={resumeUploadRef}
          className="upload-card glass-panel mt-8 rounded-2xl p-6"
        >
          <div
            onDragEnter={handleDropzoneDragEnter}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingFile(true);
            }}
            onDragLeave={handleDropzoneDragLeave}
            onDrop={handleDropzoneDrop}
            onClick={() => resumeFileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                resumeFileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload resume PDF"
            className={`upload-dropzone relative flex min-h-[170px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all ${
              isDraggingFile
                ? "border-teal-500 bg-teal-50"
                : "border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/60"
            }`}
          >
            {isAnalyzing ? (
              <div className="analysis-drop-loader pointer-events-none">
                <div className="analysis-loader-stage w-full max-w-[360px]">
                  <div className="analysis-dropzone-mini">
                    <div className="analysis-file-chip">PDF</div>
                    <div className="analysis-drop-arrow">↓</div>
                  </div>
                  <div className="analysis-stage-track">
                    {ANALYSIS_STEPS.map((step, idx) => (
                      <span key={step} className={`analysis-stage-dot ${idx <= analysisPhase ? "is-active" : ""}`} />
                    ))}
                  </div>
                  <p className="mt-3 text-base font-semibold text-slate-900">{ANALYSIS_STEPS[analysisPhase]}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${((analysisPhase + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Uploading • Processing • Scanning</p>
                  <div className="analysis-phase-icons mt-2">
                    {ANALYSIS_STEP_META.map((item, idx) => (
                      <span key={item.key} className={`analysis-phase-pill ${idx <= analysisPhase ? "is-active" : ""}`}>
                        <span className="analysis-phase-glyph" aria-hidden="true">{item.glyph}</span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : !fileName ? (
              <div className="pointer-events-none">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-lg text-teal-700">↑</div>
                <p className="text-sm font-semibold text-slate-700">Drag & drop resume here</p>
                <p className="mt-1 text-xs text-slate-500">PDF only. Click to browse.</p>
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-lg text-slate-600">✓</div>
                <p className="text-sm font-semibold text-slate-800">{fileName}</p>
                <p className="mt-1 text-xs text-slate-500">Resume uploaded. Drag-drop or click to replace.</p>
              </div>
            )}
          </div>
          <input
            ref={resumeFileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => handleResumeFileSelect(e.target.files?.[0] || null)}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          {errorMessage ? <p className="mt-3 text-sm font-medium text-red-600">{errorMessage}</p> : null}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
          >
            {isAnalyzing ? (
              <>
                <span className="spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                Analyzing...
              </>
            ) : (
              "Analyze Resume"
            )}
          </button>
        </motion.div>
        <motion.div
          ref={analysisResultRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <div className={`card-lift rounded-xl border p-4 ${(activeResult?.score || 0) >= 49 ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/40"}`}>
            <p className="text-xs text-slate-500">Avg Resume Score</p>
            <p className={`mt-1 text-xl font-bold ${getScoreTextClass(activeResult?.score || 0, 49)}`}>{hasAnalysis ? `${activeResult?.score || 0}%` : "0%"}</p>
            {scoreDelta !== null ? (
              <p className={`mt-1 text-xs font-semibold ${scoreDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}% vs previous run
              </p>
            ) : null}
          </div>
          <div className="card-lift rounded-xl border border-[var(--border)] bg-white p-4">
            <p className="text-xs text-slate-500">Top Missing Skill</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-dark)]">{topMissingSkill}</p>
          </div>
          <div className="card-lift rounded-xl border border-[var(--border)] bg-white p-4">
            <p className="text-xs text-slate-500">Analysis Time</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-dark)]">{analysisTimeLabel}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.26 }}
          className="glass-panel mt-6 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-800">Analysis Summary</p>
          </div>
          {!hasAnalysis ? (
            <p className="mt-4 text-sm text-slate-600">
              Upload and analyze a resume to view summary insights for the selected domain.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="glass-soft rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700">Recommendation</p>
                <p className="mt-2 text-sm text-slate-600">
                  {activeResult?.suggestions || "No suggestions available."}
                </p>
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedRole}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Extracted Skills</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {(activeResult?.extractedSkills || []).length} detected
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(activeResult?.extractedSkills || []).length ? (activeResult.extractedSkills || []).map((skill, index) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] leading-none text-slate-600">
                        {index + 1}
                      </span>
                      {skill}
                    </span>
                  )) : <span className="text-xs text-slate-500">Not available</span>}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          id="verification-test"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proof Test</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Resume Verification Test</p>
                <p className="mt-2 text-sm text-slate-600">
                  Skill-wise questions generated from your resume to validate authenticity and shortlist quality.
                </p>
              </div>
              <button
                onClick={handleGenerateClaimTest}
                disabled={isGeneratingClaimTest}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
              >
                {isGeneratingClaimTest ? "Generating..." : "Generate Test"}
              </button>
            </div>
          </div>

          <div className="px-4 py-4 md:px-6 md:py-5">
            {!activeResumeFile ? (
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                Upload a resume to generate the claim verification test.
              </p>
            ) : null}
            {claimError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{claimError}</p> : null}

            {claimTest?.questions?.length ? (
              <div className="mt-1">
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Claimed Skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(claimTest.claimedSkills || []).map((skill) => (
                      <span key={skill} className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              <div ref={claimQuestionsRef} className="mt-4 space-y-4">
                  {claimQuestionGroups.map((group) => (
                    <div key={group.skill} className="overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-3 py-3 md:px-4">
                        <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-700">{group.skill} Section</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {group.questions.length} Questions
                        </span>
                      </div>
                      <div className="space-y-4 px-4 py-4">
                        {group.questions.map((question, questionIndex) => (
                          <div key={question.id} className="verification-question-card rounded-xl border border-slate-200/90 bg-white/70 p-4 shadow-[0_6px_14px_rgba(15,23,42,0.05)]">
                            <p className="text-base font-semibold text-slate-900">
                              Q{questionIndex + 1}. {question.prompt}
                            </p>
                            <div className="mt-3 space-y-2 overflow-hidden">
                              {(question.options || []).map((option, optionIndex) => (
                                <label
                                  key={`${question.id}-${optionIndex}`}
                                  className={`verification-option flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed transition ${
                                    claimAnswers[question.id] === optionIndex
                                      ? "border-teal-500/70 bg-teal-50/80 text-slate-900 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={question.id}
                                    checked={claimAnswers[question.id] === optionIndex}
                                    onChange={() => handleSelectAnswer(question.id, optionIndex)}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <span className="min-w-0 whitespace-normal break-words leading-snug">{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center">
                  <p className="text-sm font-medium text-slate-800">Click “Show My Result” to generate your score.</p>
                  <button
                    onClick={handleSubmitClaimTest}
                    disabled={isSubmittingClaimTest}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
                  >
                    {isSubmittingClaimTest ? "Submitting..." : "Show My Result"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>

        {claimResult ? (
          <motion.div
            ref={claimResultRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34 }}
            className="glass-panel mt-6 rounded-2xl p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-800">Claim Verification Result</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                  {claimStatusLabel || "Pending"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Authenticity: {claimResult.authenticityScore || 0}%
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className={`rounded-xl border p-4 ${(claimResult.authenticityScore || 0) >= 49 ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/40"}`}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Overall Score</p>
                <p className={`mt-2 text-3xl font-bold ${getScoreTextClass(claimResult.authenticityScore || 0, 49)}`}>{claimResult.authenticityScore || 0}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Skills Rating</p>
                <p className="mt-2 text-3xl font-bold text-slate-800">{(claimResult.skillBreakdown || []).length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Top Match Company</p>
                <p className="mt-2 text-lg font-bold text-slate-800">{claimResult.shortlist?.[0]?.companyName || "N/A"}</p>
                <p className="text-xs text-slate-500">{claimResult.shortlist?.[0]?.role || ""}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Skill Breakdown</p>
                <div className="mt-3 space-y-2">
                  {(claimResult.skillBreakdown || []).map((item) => (
                    <div key={item.skill} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{item.skill}</span>
                        <span className={`font-semibold ${getScoreTextClass(item.score, 49)}`}>{item.score}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-teal-500"
                          style={{ width: `${Math.max(0, Math.min(100, Number(item.score) || 0))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Company Shortlist</p>
                <div className="mt-3 space-y-2">
                  {(claimResult.shortlist || []).length ? (claimResult.shortlist || []).map((company, rank) => (
                    <div key={company.companyId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">{company.companyName} - {company.role}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          Rank #{rank + 1}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                        <span className="rounded bg-white px-2 py-1 text-center font-semibold">Fit {company.fitScore}%</span>
                        <span className="rounded bg-white px-2 py-1 text-center font-semibold">Test {company.testScore}%</span>
                        <span className="rounded bg-white px-2 py-1 text-center font-semibold">Coverage {company.claimCoverage}%</span>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                      No matching companies found for the current resume skill set.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        </div>
      </div>
    </div>
  );
}

function WorkspaceSidebar() {
  const { isDark } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [lockError, setLockError] = useState("");
  const hasVerificationAccess = Boolean(appState.getClaimResult());
  const lockedItemClass = `block min-w-max rounded-lg border px-3 py-2.5 text-[14px] font-medium cursor-not-allowed opacity-75 lg:min-w-0 ${
    isDark ? "text-slate-500" : "text-slate-400"
  }`;
  const activeClass = "block min-w-max rounded-lg border px-3 py-2.5 text-[14px] font-medium transition-colors lg:min-w-0";
  const navClass = ({ isActive }) =>
    `${activeClass} ${
      isActive
        ? (isDark
          ? "border-slate-500 bg-slate-800/75 text-slate-100"
          : "border-slate-300 bg-white text-slate-900")
        : (isDark
          ? "border-slate-700/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800/50 hover:text-slate-100"
          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-800")
    }`;
  const handleLockedClick = () => {
    const message = "Please complete the Resume Verification Test first.";
    setLockError(message);
    window.alert(message);
    navigate(`/analyze?focus=verification&t=${Date.now()}#verification-test`);
  };

  return (
    <aside className={`no-print top-0 z-30 border-b px-3 py-3 backdrop-blur lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-[256px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-6 ${
      isDark
        ? "border-slate-700/80 bg-slate-900/95"
        : "border-slate-200/90 bg-slate-50/95"
    }`}>
      <p className={`mb-3 hidden text-[11px] font-semibold uppercase tracking-[0.14em] lg:block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Command Center</p>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0">
        <NavLink to="/analyze" className={navClass}>
          Analyze
        </NavLink>
        {hasVerificationAccess ? (
          <>
            <NavLink to="/missing-skills" className={navClass}>Missing Skills</NavLink>
            <NavLink to="/ats-checker" className={navClass}>ATS Checker</NavLink>
            <NavLink to="/icm-score" className={navClass}>ICM Score</NavLink>
            <NavLink to="/role-match" className={navClass}>Role Match</NavLink>
            <NavLink to="/application-readiness" className={navClass}>Application Readiness</NavLink>
            <NavLink to="/interview-loop" className={navClass}>Interview Loop</NavLink>
            <NavLink to="/roadmap-builder" className={navClass}>Roadmap</NavLink>
          </>
        ) : (
          <>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>Missing Skills</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>ATS Checker</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>ICM Score</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>Role Match</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>Application Readiness</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>Interview Loop</button>
            <button type="button" onClick={handleLockedClick} className={`${lockedItemClass} min-w-max text-left lg:w-full`}>Roadmap</button>
          </>
        )}
        {lockError ? (
          <p className={`mt-2 rounded-md px-3 py-2 text-xs font-medium ${
            isDark
              ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {lockError}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function ProtectedWorkspaceRoute({ children }) {
  const hasVerificationAccess = Boolean(appState.getClaimResult());
  if (!hasVerificationAccess) {
    return <Navigate to="/analyze" replace />;
  }
  return children;
}

function AtsCheckerPage() {
  const parsed = getStoredAnalysisResult();
  const hasAnalysis = Boolean(parsed);
  const analysisMeta = appState.getAnalysisMeta();
  const extractedSkills = parsed?.extractedSkills || [];
  const matchedSkills = parsed?.matchedSkills || [];
  const missingSkills = parsed?.missingSkills || [];
  const selectedRole = (() => {
    return appState.getSelectedRole() || "Backend Developer";
  })();

  const keywordCoverage = extractedSkills.length
    ? Math.round((matchedSkills.length / Math.max(extractedSkills.length, 1)) * 100)
    : 0;
  const roleCoverage = matchedSkills.length + missingSkills.length
    ? Math.round((matchedSkills.length / (matchedSkills.length + missingSkills.length)) * 100)
    : 0;
  const readabilityScore = hasAnalysis ? 82 : 0;
  const formatScore = hasAnalysis ? 86 : 0;
  const atsScore = hasAnalysis
    ? Math.round((0.35 * keywordCoverage) + (0.35 * roleCoverage) + (0.2 * readabilityScore) + (0.1 * formatScore))
    : 0;
  const atsScoreClass = getScoreTextClass(atsScore, 49);
  const readabilityClass = getScoreTextClass(readabilityScore, 49);
  const formatClass = getScoreTextClass(formatScore, 49);
  const keywordCoverageClass = getScoreTextClass(keywordCoverage, 49);
  const roleCoverageClass = getScoreTextClass(roleCoverage, 49);

  const issueChecklist = [
    {
      label: "Missing role keywords",
      status: missingSkills.length ? "warning" : "good",
      detail: missingSkills.length
        ? `${missingSkills.length} role keywords are missing for ${selectedRole}.`
        : "Core role keywords are covered.",
      meta: missingSkills.length
        ? `Missing: ${missingSkills.slice(0, 6).join(", ")}${missingSkills.length > 6 ? "..." : ""}`
        : "No high-priority role keyword gap detected.",
      action: missingSkills.length
        ? "Add these keywords in Projects/Experience bullets with measurable outcomes."
        : "Maintain current keyword strength with fresh project evidence.",
    },
    {
      label: "Section structure",
      status: hasAnalysis ? "good" : "warning",
      detail: hasAnalysis ? "Resume sections appear ATS-friendly." : "Run analysis to validate section structure.",
      meta: hasAnalysis
        ? "Detected: Summary, Skills, Projects, Experience section flow."
        : "Section parsing not available yet.",
      action: hasAnalysis
        ? "Keep section headers simple (Skills, Experience, Projects, Education)."
        : "Analyze resume to generate section-level structure checks.",
    },
    {
      label: "Keyword repetition",
      status: keywordCoverage >= 65 ? "good" : "warning",
      detail: keywordCoverage >= 65 ? "Keyword distribution looks healthy." : "Add domain keywords in projects/experience.",
      meta: `Coverage: ${keywordCoverage}% of extracted skills align with detected role signals.`,
      action: keywordCoverage >= 65
        ? "Keep balance; avoid stuffing same keyword repeatedly."
        : "Repeat target domain keywords naturally across at least 2 sections.",
    },
    {
      label: "Role alignment",
      status: roleCoverage >= 70 ? "good" : "warning",
      detail: roleCoverage >= 70 ? `Strong for ${selectedRole}.` : `Needs better alignment for ${selectedRole}.`,
      meta: `Alignment ratio: ${matchedSkills.length} matched vs ${missingSkills.length} missing role skills.`,
      action: roleCoverage >= 70
        ? "Focus on impact-based bullets to push from match to shortlist-ready."
        : `Prioritize ${selectedRole} domain gaps first: ${missingSkills.slice(0, 3).join(", ") || "core role skills"}.`,
    },
  ];

  const topRecommendations = missingSkills.slice(0, 4).map((skill) => ({
    title: `Add ${skill} evidence`,
    desc: `Include one project bullet with measurable impact using ${skill}.`,
  }));
  const passedChecks = issueChecklist.filter((item) => item.status === "good").length;
  const reviewChecks = issueChecklist.length - passedChecks;
  const passRate = issueChecklist.length ? Math.round((passedChecks / issueChecklist.length) * 100) : 0;
  const reviewRate = issueChecklist.length ? Math.round((reviewChecks / issueChecklist.length) * 100) : 0;

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ATS Checker</p>
              <h1 className="mt-2 text-3xl font-bold md:text-5xl text-slate-900">ATS Precision Check</h1>
            </div>
            <section className="space-y-6">
              <div className="editorial-strip rounded-xl p-6">
                <p className="text-base font-semibold uppercase tracking-wide text-slate-500">Scanner Overview</p>
                <p className="mt-3 text-lg text-slate-600">
                  Active role benchmark: <span className="font-semibold text-slate-700">{selectedRole}</span>
                </p>
                {hasAnalysis && analysisMeta ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {`Source: ${String(analysisMeta.source || "unknown").toUpperCase()} | Time: ${formatAnalysisDuration(Number(analysisMeta.durationMs || 0))}`}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className={`editorial-strip rounded-xl p-5 ${atsScore >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
                  <p className="text-base font-semibold uppercase tracking-wide text-slate-500">ATS Index</p>
                  <p className={`mt-1 text-5xl font-bold ${atsScoreClass}`}>{atsScore}</p>
                  <p className="text-lg text-slate-500">scanner score</p>
                </div>
                <div className={`editorial-strip rounded-xl p-5 ${readabilityScore >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
                  <p className="text-lg font-semibold text-slate-700">Parsing Clarity</p>
                  <p className={`mt-1 text-3xl font-bold ${readabilityClass}`}>{readabilityScore}%</p>
                  <p className="mt-2 text-base text-slate-600">How cleanly ATS can interpret your section structure.</p>
                </div>
                <div className={`editorial-strip rounded-xl p-5 ${formatScore >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
                  <p className="text-lg font-semibold text-slate-700">Template Stability</p>
                  <p className={`mt-1 text-3xl font-bold ${formatClass}`}>{formatScore}%</p>
                  <p className="mt-2 text-base text-slate-600">Layout reliability across recruiter ATS systems.</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="editorial-strip flex h-full flex-col rounded-xl p-5">
                  <p className="text-lg font-semibold text-slate-700">Coverage Snapshot</p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-base text-slate-500">Keyword Coverage</p>
                      <p className={`text-xl font-bold ${keywordCoverageClass}`}>{keywordCoverage}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-base text-slate-500">Role Alignment</p>
                      <p className={`text-xl font-bold ${roleCoverageClass}`}>{roleCoverage}%</p>
                    </div>
                  </div>
                  {!hasAnalysis && (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-800">
                      Upload + analyze resume to unlock full ATS diagnostics.
                    </p>
                  )}
                </div>
                <div className="editorial-strip h-fit rounded-xl p-5">
                  <p className="text-lg font-semibold text-slate-700">Role Alignment Notes</p>
                  <p className="mt-2 text-base text-slate-600">
                    Baseline is <span className="font-semibold">{selectedRole}</span>. Signals are measured against role-specific hiring keywords.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-lg border border-slate-100 bg-white px-4 py-3">
                      <p className="text-base font-semibold text-slate-800">Domain keyword need</p>
                      <p className="text-base text-slate-600">
                        {missingSkills.length
                          ? `${selectedRole} domain still needs better alignment on: ${missingSkills.slice(0, 5).join(", ")}${missingSkills.length > 5 ? "..." : ""}.`
                          : `No major ${selectedRole} domain keyword gap detected.`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-4 py-3">
                      <p className="text-base font-semibold text-slate-800">Optimization Direction</p>
                      <p className="text-base text-slate-600">
                        Add one impact bullet per missing keyword in project or experience section, and mirror JD wording where relevant.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <div className="editorial-strip h-fit rounded-xl p-4">
                  <p className="text-base font-semibold text-slate-700">Checks</p>
                  <p className="mt-1 text-sm text-slate-600">Compact ATS check dashboard with pass/review status.</p>
                  <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>Checks Overview</span>
                      <span>{passedChecks} Pass / {reviewChecks} Review</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                      <div className="flex h-2.5 overflow-hidden rounded-full">
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${passRate}%` }}
                        />
                        <div
                          className="bg-rose-500"
                          style={{ width: `${reviewRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {issueChecklist.map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-600">{item.detail}</p>
                          </div>
                          <span className={`mt-0.5 rounded-full px-2.5 py-1 text-sm font-semibold ${item.status === "good" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {item.status === "good" ? "Pass" : "Review"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                        <p className="mt-1 text-xs font-medium text-slate-600">Fix: {item.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="editorial-strip flex h-full flex-col rounded-xl p-4">
                  <p className="text-base font-semibold text-slate-700">Suggested Fixes</p>
                  <p className="mt-1 text-sm text-slate-600">Highest-impact edits to improve shortlisting probability.</p>
                  <div className="mt-3 space-y-2">
                    {(topRecommendations.length ? topRecommendations : [
                      { title: "No urgent gaps", desc: "Current resume looks aligned with selected role." },
                    ]).map((item) => (
                      <div key={item.title} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="text-base font-medium text-slate-800">{item.title}</p>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fix Priority Queue</p>
                    <div className="mt-2 space-y-1.5">
                      {(missingSkills.length ? missingSkills : ["No priority keyword gap"]).slice(0, 6).map((skill, idx) => (
                        <div key={`${skill}-${idx}`} className="rounded-md bg-slate-50 px-2.5 py-1.5">
                          <span className="text-sm text-slate-700">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution Note</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Implement top 2 fixes first, then rerun ATS scan to track score movement before next submission.
                    </p>
                  </div>
                </div>
              </div>

              <div className="editorial-strip rounded-xl p-4">
                <p className="text-base font-semibold text-slate-700">Report Note</p>
                <p className="mt-1 text-sm text-slate-600">
                  ATS output is now organized in aligned blocks for faster review. Apply items marked <span className="font-semibold">Review</span>, then run analysis again.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceTopbar() {
  const { isDark, toggleTheme } = useContext(ThemeContext);

  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-1 pb-4">
      <p className="premium-title flex items-center gap-2 text-2xl font-bold text-slate-800">
        <span className="inline-flex h-6 w-5 items-center justify-center rounded-sm border border-slate-300 bg-white text-[10px] font-bold text-slate-900">▤</span>
        ResumePilot
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          type="button"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`relative flex h-10 w-[78px] items-center rounded-full border p-1 transition-all duration-300 active:translate-y-[1px] ${
            isDark
              ? "border-slate-700 bg-gradient-to-b from-[#1f2937] via-[#111827] to-[#020617] shadow-[inset_0_1px_0_rgba(148,163,184,0.25),0_8px_18px_rgba(2,6,23,0.45)]"
              : "border-sky-200 bg-gradient-to-b from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_16px_rgba(30,41,59,0.18)]"
          }`}
        >
          <span
            className={`absolute top-[3px] h-8 w-8 rounded-full border transition-all duration-300 ${
              isDark
                ? "left-[42px] border-slate-500 bg-gradient-to-b from-slate-100 to-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_10px_rgba(15,23,42,0.45)]"
                : "left-[3px] border-amber-200 bg-gradient-to-b from-white to-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_10px_rgba(120,53,15,0.25)]"
            }`}
          />
          <span
            className={`relative z-10 grid h-8 w-8 place-items-center rounded-full transition-all ${
              !isDark ? "text-amber-700" : "text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.9" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </span>
          <span
            className={`relative z-10 ml-auto grid h-8 w-8 place-items-center rounded-full transition-all ${
              isDark ? "text-cyan-200" : "text-slate-500"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M20.6 14.2A8.2 8.2 0 1 1 9.8 3.4a7 7 0 1 0 10.8 10.8z" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

function PageExportActions({ className = "" }) {
  return (
    <div className={`no-print flex flex-wrap items-center justify-end gap-2 ${className}`}>
      <button
        onClick={() => window.print()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Print PDF
      </button>
    </div>
  );
}

function RoleMatchPage() {
  const roleMatchResultsRef = useRef(null);
  const skillCatalog = [
    "React", "JavaScript", "TypeScript", "CSS", "REST API",
    "Node", "Express", "MongoDB", "System Design", "SQL",
    "Python", "Statistics", "Excel", "Data Visualization",
    "Docker", "AWS", "Git", "DSA",
  ];
  const selectedRole = (() => {
    return appState.getSelectedRole() || "Backend Developer";
  })();
  const [jdText, setJdText] = useState("");
  const [jdSkills, setJdSkills] = useState([]);
  const [hasDetectedJD, setHasDetectedJD] = useState(false);
  const [jdSignal, setJdSignal] = useState({ mustHave: [], preferred: [], tools: [] });

  const parsed = getStoredAnalysisResult();
  const hasAnalysis = Boolean(parsed);
  const synonymMap = {
    "node.js": "Node",
    "nodejs": "Node",
    "js": "JavaScript",
    "ts": "TypeScript",
    "express.js": "Express",
    "rest": "REST API",
    "restful api": "REST API",
    "data visualisation": "Data Visualization",
  };

  const normalizeSkill = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "node.js" || raw === "nodejs") return "node";
    if (raw === "js") return "javascript";
    if (raw === "ts") return "typescript";
    if (raw === "express.js") return "express";
    if (raw === "restful api" || raw === "rest") return "rest api";
    if (raw === "data visualisation") return "data visualization";
    return raw;
  };

  const extracted = [...new Set([
    ...((parsed?.extractedSkills && parsed.extractedSkills.length) ? parsed.extractedSkills : []),
    ...((parsed?.matchedSkills && parsed.matchedSkills.length) ? parsed.matchedSkills : []),
  ])];
  const extractedSet = new Set(extracted.map((s) => normalizeSkill(s)));
  const hasJdInput = Boolean(jdText.trim());
  const canShowRoleMatchResults = hasDetectedJD && jdSkills.length > 0;
  const requiredSkills = hasAnalysis && canShowRoleMatchResults ? jdSkills : [];
  const matched = requiredSkills.filter((s) => extractedSet.has(normalizeSkill(s)));
  const missing = requiredSkills.filter((s) => !extractedSet.has(normalizeSkill(s)));
  const computeWeightedFit = () => {
    if (!(hasAnalysis && hasDetectedJD && jdSkills.length)) {
      return requiredSkills.length ? Math.round((matched.length / requiredSkills.length) * 100) : 0;
    }
    const groups = [
      { skills: jdSignal.mustHave, weight: 0.6 },
      { skills: jdSignal.preferred, weight: 0.3 },
      { skills: jdSignal.tools, weight: 0.1 },
    ].filter((g) => g.skills.length);
    if (!groups.length) return requiredSkills.length ? Math.round((matched.length / requiredSkills.length) * 100) : 0;
    const score = groups.reduce((acc, group) => {
      const matchedInGroup = group.skills.filter((skill) => extractedSet.has(normalizeSkill(skill))).length;
      return acc + ((matchedInGroup / group.skills.length) * group.weight * 100);
    }, 0);
    return Math.round(score);
  };
  const fitScore = computeWeightedFit();
  const matchedRatioPercent = requiredSkills.length ? Math.round((matched.length / requiredSkills.length) * 100) : 0;
  const missingRatioPercent = requiredSkills.length ? Math.round((missing.length / requiredSkills.length) * 100) : 0;
  const fitScoreTextClass = getScoreTextClass(fitScore, 49);
  const fitScoreBarClass = getScoreBarClass(fitScore, 49);
  const matchedRatioTextClass = getScoreTextClass(matchedRatioPercent, 49);
  const matchedRatioBarClass = getScoreBarClass(matchedRatioPercent, 49);
  const missingRatioTextClass = getInverseScoreTextClass(missingRatioPercent, 49);
  const missingRatioBarClass = getInverseScoreBarClass(missingRatioPercent, 49);
  const evidenceQuality = (() => {
    const matchedRatio = requiredSkills.length ? (matched.length / requiredSkills.length) : 0;
    const mentionDepth = extracted.length ? (matched.length / extracted.length) : 0;
    const score = Math.round(((matchedRatio * 0.7) + (mentionDepth * 0.3)) * 100);
    const band = score >= 75 ? "Strong Evidence" : score >= 50 ? "Moderate Evidence" : "Low Evidence";
    return { score, band };
  })();

  const detectSkillsFromText = (inputText) => {
    const text = inputText.toLowerCase();
    const normalizedText = Object.entries(synonymMap).reduce(
      (acc, [alias, canonical]) => {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, "g");
        return acc.replace(aliasRegex, canonical.toLowerCase());
      },
      text
    );

    const found = skillCatalog.filter((skill) => {
      const escapedSkill = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const skillRegex = new RegExp(`\\b${escapedSkill}\\b`, "i");
      return skillRegex.test(normalizedText);
    });
    const chunks = inputText
      .split(/[\n.]/)
      .map((line) => line.trim())
      .filter(Boolean);
    const requiredHint = /\b(must|required|mandatory|need to|strong)\b/i;
    const preferredHint = /\b(preferred|plus|good to have|nice to have|bonus)\b/i;
    const toolHint = /\b(tool|stack|framework|platform|library|tech)\b/i;
    const mustHave = [];
    const preferred = [];
    const tools = [];

    found.forEach((skill) => {
      const inLines = chunks.filter((line) => new RegExp(`\\b${skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line));
      const hasRequired = inLines.some((line) => requiredHint.test(line));
      const hasPreferred = inLines.some((line) => preferredHint.test(line));
      const hasTool = inLines.some((line) => toolHint.test(line));
      if (hasRequired) mustHave.push(skill);
      else if (hasPreferred) preferred.push(skill);
      else if (hasTool) tools.push(skill);
      else preferred.push(skill);
    });

    return {
      skills: [...new Set(found)],
      signal: {
        mustHave: [...new Set(mustHave)],
        preferred: [...new Set(preferred)],
        tools: [...new Set(tools)],
      },
    };
  };

  const detectSkillsFromJD = () => {
    if (!jdText.trim()) {
      setHasDetectedJD(false);
      setJdSkills([]);
      setJdSignal({ mustHave: [], preferred: [], tools: [] });
      appState.setJdDetected(false);
      return;
    }
    setHasDetectedJD(true);
    const result = detectSkillsFromText(jdText);
    setJdSkills(result.skills);
    setJdSignal(result.signal);
    appState.setJdDetected(Boolean(result.skills.length));
    window.requestAnimationFrame(() => {
      if (roleMatchResultsRef.current) {
        roleMatchResultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h1 className="text-3xl font-bold">Role Match</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Check role-specific fit and missing requirements.
                  {` Selected role: ${selectedRole}.`}
                </p>
              </div>
            </div>

            <div className="editorial-strip mt-4 rounded-xl p-4">
              {!hasAnalysis && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  No resume analysis found. Accurate role match ke liye pehle Analyze page par resume upload karo.
                </div>
              )}
              <p className="text-sm font-semibold text-slate-700">Job Description Input</p>
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  setHasDetectedJD(false);
                  setJdSkills([]);
                  setJdSignal({ mustHave: [], preferred: [], tools: [] });
                  appState.setJdDetected(false);
                }}
                placeholder="Paste JD here. Result tabhi show hoga jab aap Detect Skills from JD click karoge."
                className="mt-2 h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={detectSkillsFromJD}
                  disabled={!hasJdInput}
                  className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Detect Skills from JD
                </button>
                <button
                  onClick={() => {
                    setJdText("");
                    setJdSkills([]);
                    setHasDetectedJD(false);
                    setJdSignal({ mustHave: [], preferred: [], tools: [] });
                    appState.setJdDetected(false);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Reset JD
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Mode: {!hasDetectedJD
                  ? "Waiting for skill detection"
                  : !jdText.trim()
                  ? "Waiting for JD input"
                  : jdSkills.length
                    ? "JD-based required skills"
                    : "JD detected, but mapped skills were not found in catalog"}
              </p>
              {hasDetectedJD && jdSkills.length ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Must Have</p>
                    <p className="text-xs font-semibold text-rose-800">{jdSignal.mustHave.length || 0}</p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Preferred</p>
                    <p className="text-xs font-semibold text-amber-800">{jdSignal.preferred.length || 0}</p>
                  </div>
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Tools</p>
                    <p className="text-xs font-semibold text-sky-800">{jdSignal.tools.length || 0}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {!hasJdInput ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                JD paste karo, tabhi Role Match activity aur comparison result show honge.
              </div>
            ) : !hasDetectedJD ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                JD paste ho chuka hai. Ab <span className="font-semibold">Detect Skills from JD</span> click karo to result generate ho.
              </div>
            ) : null}

            {canShowRoleMatchResults ? (
              <>
            <div ref={roleMatchResultsRef} className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="editorial-strip card-lift rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Role Fit</p>
                <p className={`mt-1 text-3xl font-bold ${fitScoreTextClass}`}>{fitScore}%</p>
              </div>
              <div className={`editorial-strip card-lift rounded-xl border p-4 ${matchedRatioPercent >= 49 ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/40"}`}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Matched</p>
                <p className="mt-1 text-3xl font-bold text-emerald-700">{matched.length}</p>
              </div>
              <div className="editorial-strip card-lift rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Missing</p>
                <p className="mt-1 text-3xl font-bold text-rose-700">{missing.length}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="editorial-strip rounded-xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Risk Zone</p>
                    <p className="text-lg font-bold text-slate-800">Missing Skills</p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                    {missing.length}
                  </span>
                </div>
                <div className="mb-4 h-2.5 rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-rose-500 to-red-500"
                    style={{ width: `${requiredSkills.length ? Math.round((missing.length / requiredSkills.length) * 100) : 0}%` }}
                  />
                </div>
                <div className="grid gap-2">
                  {missing.length ? missing.map((s) => (
                    <div key={s} className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                      <span className="text-sm font-medium text-rose-900">{s}</span>
                      <span className="text-xs font-semibold text-rose-700">High Priority</span>
                    </div>
                  )) : <span className="text-sm font-medium text-slate-500">No missing skill</span>}
                </div>
              </div>

              <div className="editorial-strip rounded-xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Strength Zone</p>
                    <p className="text-lg font-bold text-slate-800">Matched Skills</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                    {matched.length}
                  </span>
                </div>
                <div className="mb-4 h-2.5 rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600"
                    style={{ width: `${requiredSkills.length ? Math.round((matched.length / requiredSkills.length) * 100) : 0}%` }}
                  />
                </div>
                <div className="grid gap-2">
                  {matched.length ? matched.map((s) => (
                    <div key={s} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                      <span className="text-sm font-medium text-emerald-900">{s}</span>
                      <span className="text-xs font-semibold text-emerald-700">Confirmed</span>
                    </div>
                  )) : <span className="text-sm font-medium text-slate-500">No matched skill</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="editorial-strip h-fit rounded-xl p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Role Match Analytics</p>
                  <span className="text-xs text-slate-500">Live chart view</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role Fit</p>
                      <p className={`mt-1 text-3xl font-bold ${fitScoreTextClass}`}>{fitScore}%</p>
                      <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                        <div className={`h-2.5 rounded-full ${fitScoreBarClass}`} style={{ width: `${fitScore}%` }} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched Ratio</p>
                      <p className={`mt-1 text-3xl font-bold ${matchedRatioTextClass}`}>{matchedRatioPercent}%</p>
                      <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                        <div
                          className={`h-2.5 rounded-full ${matchedRatioBarClass}`}
                          style={{ width: `${matchedRatioPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing Ratio</p>
                      <p className={`mt-1 text-3xl font-bold ${missingRatioTextClass}`}>{missingRatioPercent}%</p>
                      <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                        <div
                          className={`h-2.5 rounded-full ${missingRatioBarClass}`}
                          style={{ width: `${missingRatioPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence Quality</p>
                      <p className={`text-sm font-semibold ${getScoreTextClass(evidenceQuality.score, 49)}`}>{evidenceQuality.band}</p>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div className={`h-2.5 rounded-full ${getScoreBarClass(evidenceQuality.score, 49)}`} style={{ width: `${evidenceQuality.score}%` }} />
                    </div>
                    <p className={`mt-1 text-xs ${getScoreTextClass(evidenceQuality.score, 49)}`}>Confidence score: {evidenceQuality.score}%</p>
                  </div>
                </div>
              </div>

              <div className="editorial-strip h-fit rounded-xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">Application Strategy</p>
                  <span className="text-xs text-slate-500">Action-first view</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Matched Skills</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{matched.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Gaps to Close</p>
                    <p className="mt-1 text-2xl font-bold text-rose-700">{missing.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
                    <p className={`mt-1 text-2xl font-bold ${matchedRatioTextClass}`}>{matchedRatioPercent}%</p>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">
                  <div className="grid gap-2 px-3 py-3 md:grid-cols-[180px_1fr]">
                    <p className="text-sm font-semibold text-slate-700">Apply Now To</p>
                    <p className="text-sm text-slate-600">Companies where JD overlap is high and missing skills are 2 or less.</p>
                  </div>
                  <div className="grid gap-2 px-3 py-3 md:grid-cols-[180px_1fr]">
                    <p className="text-sm font-semibold text-slate-700">Prepare First</p>
                    <p className="text-sm text-slate-600">If missing skills are 3-5, add 2 proof bullets and 1 project update before applying.</p>
                  </div>
                  <div className="grid gap-2 px-3 py-3 md:grid-cols-[180px_1fr]">
                    <p className="text-sm font-semibold text-slate-700">Hold & Improve</p>
                    <p className="text-sm text-slate-600">If core stack is missing, prioritize targeted learning sprint and re-run analysis.</p>
                  </div>
                </div>
              </div>
            </div>
              </>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}

function MissingSkillsPage() {
  const parsed = getStoredAnalysisResult();
  const hasAnalysis = Boolean(parsed);
  const selectedRole = (() => {
    return appState.getSelectedRole() || "Backend Developer";
  })();

  const missingSkills = parsed?.missingSkills || [];
  const matchedSkills = parsed?.matchedSkills || [];
  const [progressMap, setProgressMap] = useState({});

  const skillPlan = missingSkills.map((skill, idx) => {
    const priority = idx === 0 ? "Critical" : idx === 1 ? "Medium" : "Nice-to-have";
    const impact = idx === 0 ? 9 : idx === 1 ? 7 : 5;
    const effort = idx === 0 ? "High" : idx === 1 ? "Medium" : "Low";

    return {
      skill,
      priority,
      impact,
      effort,
      reason: "Required keyword or project evidence not found in resume.",
      project: `Build mini ${skill} project with measurable outcomes.`,
      course: `Complete one structured ${skill} learning path.`,
      timeline: idx === 0 ? "14 days" : "7 days",
    };
  });

  const toggleProgress = (skill) => {
    setProgressMap((prev) => {
      const current = prev[skill] || "Not Started";
      const next =
        current === "Not Started"
          ? "In Progress"
          : "Completed";
      return { ...prev, [skill]: next };
    });
  };

  const completedCount = missingSkills.filter(
    (skill) => (progressMap[skill] || "Not Started") === "Completed"
  ).length;
  const inProgressCount = missingSkills.filter(
    (skill) => (progressMap[skill] || "Not Started") === "In Progress"
  ).length;
  const completionRate = missingSkills.length
    ? Math.round((completedCount / missingSkills.length) * 100)
    : 0;
  const totalSkillsTracked = Math.max(matchedSkills.length + missingSkills.length, 1);
  const matchedRate = Math.round((matchedSkills.length / totalSkillsTracked) * 100);
  const missingRate = Math.round((missingSkills.length / totalSkillsTracked) * 100);
  const interviewQuestions = missingSkills.flatMap((skill) => ([
    `How would you apply ${skill} in a real project with measurable impact?`,
    `What are common pitfalls in ${skill}, and how do you avoid them?`,
  ])).slice(0, 10);

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />

          <section className="py-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Missing Skills</h1>
                <p className="mt-1 text-base text-slate-600">Role: {selectedRole}</p>
              </div>
            </div>

            {!hasAnalysis && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                No analysis found. Upload a resume first.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Missing</p>
                <p className={`text-2xl font-bold ${getInverseScoreTextClass(missingRate, 49)}`}>{missingSkills.length}</p>
              </div>
              <div className={`rounded-lg border p-3 ${matchedRate >= 49 ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/40"}`}>
                <p className="text-xs text-slate-500">Matched</p>
                <p className={`text-2xl font-bold ${getScoreTextClass(matchedRate, 49)}`}>{matchedSkills.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">In Progress</p>
                <p className="text-2xl font-bold text-amber-700">{inProgressCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Done</p>
                <p className={`text-2xl font-bold ${getScoreTextClass(completionRate, 49)}`}>{completionRate}%</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <p className="text-base font-semibold text-slate-800">Missing Skills</p>
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{missingSkills.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {missingSkills.length ? missingSkills.map((skill, idx) => (
                    <div key={skill} className="flex items-center justify-between rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{skill}</p>
                      <span className="text-xs font-semibold text-rose-700">Priority {idx + 1}</span>
                    </div>
                  )) : <span className="text-sm text-slate-500">No missing skills detected.</span>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <p className="text-base font-semibold text-slate-800">Matched Skills</p>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{matchedSkills.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {matchedSkills.length ? matchedSkills.map((skill) => (
                    <div key={skill} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{skill}</p>
                      <span className="text-xs font-semibold text-slate-600">Verified</span>
                    </div>
                  )) : <span className="text-sm text-slate-500">No matched skills yet.</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50 px-5 py-4">
                <p className="text-lg font-bold text-slate-800">Action Plan</p>
                <p className="mt-1 text-sm text-slate-600">
                  Structured execution checklist with priority, timeline, and progress tracking for each missing skill.
                </p>
              </div>

              <div className="border-b border-slate-100 px-5 py-4">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Overall Progress</span>
                  <span>{completionRate}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 transition-all"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-lg font-semibold">Skill</th>
                      <th className="px-5 py-3 text-lg font-semibold">Priority</th>
                      <th className="px-5 py-3 text-lg font-semibold">Plan</th>
                      <th className="px-5 py-3 text-lg font-semibold">Timeline</th>
                      <th className="px-5 py-3 text-lg font-semibold">Status</th>
                      <th className="px-5 py-3 text-lg font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillPlan.length ? skillPlan.map((item) => {
                      const status = progressMap[item.skill] || "Not Started";
                      const actionLabel =
                        status === "Not Started"
                          ? "Start"
                          : status === "In Progress"
                            ? "In Progress"
                            : "Completed";
                      return (
                        <tr key={item.skill} className="border-t border-slate-100">
                          <td className="px-5 py-4 align-top">
                            <p className="text-lg font-semibold text-slate-800">{item.skill}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.reason}</p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              item.priority === "Critical"
                                ? "bg-red-100 text-red-700"
                                : item.priority === "Medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top text-lg text-slate-600">
                            <p>{item.project}</p>
                            <p className="mt-1 text-base text-slate-500">{item.course}</p>
                          </td>
                          <td className="px-5 py-4 align-top text-lg text-slate-600">{item.timeline}</td>
                          <td className="px-5 py-4 align-top">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              status === "Completed"
                                ? "bg-slate-100 text-slate-600"
                                : status === "In Progress"
                                  ? "bg-teal-100 text-teal-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => toggleProgress(item.skill)}
                              disabled={status === "Completed"}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
                            >
                              {actionLabel}
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-bold text-slate-800">Interview Prep (Top Likely Questions)</p>
              <p className="mt-1 text-sm text-slate-600">Generated from your current missing skills.</p>
              <div className="mt-3 grid gap-2">
                {interviewQuestions.length ? interviewQuestions.map((question, idx) => (
                  <div key={`${idx}-${question}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-700">Q{idx + 1}. {question}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No missing skills detected. You're ready for role-specific interviews.</p>
                )}
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}

function IcmScorePage() {
  const parsed = getStoredAnalysisResult();
  const hasAnalysis = Boolean(parsed);
  const analysisMeta = appState.getAnalysisMeta();
  const matched = parsed?.matchedSkills?.length || 0;
  const missing = parsed?.missingSkills?.length || 0;
  const total = Math.max(matched + missing, 1);
  const skillScore = hasAnalysis ? Math.round((matched / total) * 100) : 0;

  const breakdown = computeWeightedScore({
    skillScore,
    experienceScore: hasAnalysis ? 75 : 0,
    projectScore: hasAnalysis ? 60 : 0,
    keywordScore: hasAnalysis ? 66 : 0,
  });
  const readinessBand =
    breakdown.finalScore >= 90
      ? "Elite Ready"
      : breakdown.finalScore >= 75
        ? "Strong Candidate"
        : breakdown.finalScore >= 60
          ? "Developing"
          : "Needs Core Improvement";
  const quickActions = [
    `Close top ${Math.max(missing, 1)} missing skill gaps`,
    "Add measurable outcomes in project bullets",
    "Improve ATS keyword alignment for selected role",
  ];
  const scoreExplainers = [
    {
      label: "Skill Score",
      value: breakdown.skillScore,
      detail: "Directly reflects matched vs missing role skills from analysis.",
    },
    {
      label: "Experience Score",
      value: breakdown.experienceScore,
      detail: "Estimates depth and consistency of practical work exposure.",
    },
    {
      label: "Project Score",
      value: breakdown.projectScore,
      detail: "Measures quality of project evidence and implementation clarity.",
    },
    {
      label: "ATS Keyword Score",
      value: breakdown.keywordScore,
      detail: "Checks recruiter/ATS keyword relevance for selected role.",
    },
  ];
  const finalScoreClass = getScoreTextClass(breakdown.finalScore, 49);

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">ICM Weighted Score</h1>
                <p className="mt-2 text-base text-[var(--muted)]">
                  Insight + Comparison + Mapping powered readiness scoring.
                </p>
                {hasAnalysis && analysisMeta ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {`Source: ${String(analysisMeta.source || "unknown").toUpperCase()} | Time: ${formatAnalysisDuration(Number(analysisMeta.durationMs || 0))}`}
                  </p>
                ) : null}
              </div>
            </div>
            {!hasAnalysis && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                No analysis found. Resume upload ke baad yahan scores visible honge.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="glass-metric card-lift rounded-xl p-4">
                <p className="text-xs text-slate-500">Skill (40%)</p>
                <p className={`mt-1 text-2xl font-bold ${getScoreTextClass(breakdown.skillScore, 49)}`}>{breakdown.skillScore}</p>
              </div>
              <div className="glass-metric card-lift rounded-xl p-4">
                <p className="text-xs text-slate-500">Experience (25%)</p>
                <p className={`mt-1 text-2xl font-bold ${getScoreTextClass(breakdown.experienceScore, 49)}`}>{breakdown.experienceScore}</p>
              </div>
              <div className="glass-metric card-lift rounded-xl p-4">
                <p className="text-xs text-slate-500">Projects (20%)</p>
                <p className={`mt-1 text-2xl font-bold ${getScoreTextClass(breakdown.projectScore, 49)}`}>{breakdown.projectScore}</p>
              </div>
              <div className="glass-metric card-lift rounded-xl p-4">
                <p className="text-xs text-slate-500">ATS Keywords (15%)</p>
                <p className={`mt-1 text-2xl font-bold ${getScoreTextClass(breakdown.keywordScore, 49)}`}>{breakdown.keywordScore}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-700">Final Formula</p>
              <p className="mt-1 text-sm text-slate-600">
                Final = (0.40 x Skill) + (0.25 x Experience) + (0.20 x Project) + (0.15 x Keyword)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Each component is weighted to reflect hiring relevance: skills first, then experience, project depth, and ATS keyword strength.
              </p>
              <p className={`mt-3 text-3xl font-bold ${finalScoreClass}`}>{breakdown.finalScore} / 100</p>
              <p className="mt-1 text-sm text-slate-600">
                {breakdown.finalScore >= 90
                  ? "Highly Job Ready"
                  : breakdown.finalScore >= 75
                    ? "Strong Candidate"
                    : breakdown.finalScore >= 60
                      ? "Needs Improvement"
                  : "Significant Skill Gaps"}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <div className="glass-soft rounded-xl p-4">
                <p className="text-lg font-semibold text-slate-700">Readiness Band</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{readinessBand}</p>
                <p className="mt-2 text-base text-slate-600">
                  This band summarizes current weighted hiring readiness from ICM scoring.
                </p>
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-700">Current Final Score</p>
                  <p className={`text-2xl font-bold ${finalScoreClass}`}>{breakdown.finalScore} / 100</p>
                </div>
              </div>
              <div className="glass-soft rounded-xl p-4">
                <p className="text-lg font-semibold text-slate-700">Recommended Next Steps</p>
                <ul className="mt-2 list-disc pl-5 text-base text-slate-600">
                  {quickActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 glass-soft rounded-xl p-4">
              <p className="text-lg font-semibold text-slate-700">Score Breakdown Explanation</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {scoreExplainers.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-800">{item.label}</p>
                      <span className={`text-lg font-bold ${getScoreTextClass(item.value, 49)}`}>{item.value}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const history = appState.getAnalysisHistory();
  const recent = history.slice(-3).reverse();
  const avgScore = history.length
    ? Math.round(history.reduce((acc, item) => acc + (Number(item.score) || 0), 0) / history.length)
    : 0;
  const latest = recent[0]?.score || 0;
  const trend = history.length >= 2 ? latest - (history[history.length - 2]?.score || 0) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-6 py-12">
      <div className="glass-panel mx-auto max-w-6xl rounded-2xl p-8">
        <PageExportActions className="mb-4" />
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="mt-3 text-[var(--muted)]">Recent analysis trend and readiness movement.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="editorial-strip rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Runs</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{history.length}</p>
          </div>
          <div className="editorial-strip rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Average Score</p>
            <p className={`mt-1 text-3xl font-bold ${getScoreTextClass(avgScore, 49)}`}>{avgScore}%</p>
          </div>
          <div className="editorial-strip rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last Delta</p>
            <p className={`mt-1 text-3xl font-bold ${trend >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {trend >= 0 ? `+${trend}` : trend}
            </p>
          </div>
        </div>
        <div className="mt-4 editorial-strip rounded-xl p-4">
          <p className="text-base font-semibold text-slate-700">Recent Analyses</p>
          <div className="mt-3 space-y-2">
            {recent.length ? recent.map((item, idx) => (
              <div key={`${item.at || idx}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-700">{item.role || "Unknown Role"} • {item.source || "unknown"}</p>
                <p className={`text-sm font-semibold ${getScoreTextClass(item.score || 0, 49)}`}>{item.score || 0}%</p>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-700">No analysis history yet.</p>
                <p className="mt-1 text-sm text-slate-500">Run your first analysis to start trend tracking.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/analyze" className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white">Run Analyze</Link>
                  <Link to="/role-match" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Import JD</Link>
                </div>
              </div>
            )}
          </div>
        </div>
        <Link to="/analyze" className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white">Go to Analyze</Link>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { isDark, setIsDark } = useContext(ThemeContext);
  const [defaultRole, setDefaultRole] = useState(() => appState.getSelectedRole() || "Backend Developer");
  const [savedNote, setSavedNote] = useState("");
  const [themeMode, setThemeMode] = useState(() => (isDark ? "dark" : "light"));

  const savePreferences = () => {
    appState.setSelectedRole(defaultRole);
    const makeDark = themeMode === "dark";
    setIsDark(makeDark);
    appState.setTheme(makeDark);
    setSavedNote("Preferences saved.");
  };

  const clearAllData = () => {
    localStorage.removeItem(ANALYSIS_RESULT_KEY);
    localStorage.removeItem(ANALYSIS_META_KEY);
    localStorage.removeItem(ANALYSIS_DURATION_KEY);
    localStorage.removeItem(ANALYSIS_HISTORY_KEY);
    localStorage.removeItem(CLAIM_RESULT_KEY);
    localStorage.removeItem(INTERVIEW_RESULT_KEY);
    setSavedNote("Analysis data cleared.");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-6 py-12">
      <div className="glass-panel mx-auto max-w-6xl rounded-2xl p-8">
        <PageExportActions className="mb-4" />
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-3 text-[var(--muted)]">Configure workspace defaults and quick controls.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="editorial-strip rounded-xl p-4">
            <p className="text-base font-semibold text-slate-700">Default Role</p>
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {Object.keys(ROLE_SKILL_MAP).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="editorial-strip rounded-xl p-4">
            <p className="text-base font-semibold text-slate-700">Theme Mode</p>
            <select
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={savePreferences} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Save Preferences</button>
          <button onClick={clearAllData} className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">Clear Analysis Data</button>
        </div>
        {savedNote ? <p className="mt-3 text-sm font-semibold text-slate-600">{savedNote}</p> : null}
        <Link to="/analyze" className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white">Go to Analyze</Link>
      </div>
    </div>
  );
}

function ApplicationReadinessPage() {
  const analysis = getStoredAnalysisResult();
  const claim = appState.getClaimResult();
  const interview = appState.getInterviewResult();
  const selectedRole = appState.getSelectedRole() || "Backend Developer";
  const score = Number(analysis?.score || 0);
  const claimScore = Number(claim?.authenticityScore || 0);
  const interviewScore = Number(interview?.overallScore || 0);
  const weighted = Math.round((score * 0.5) + (claimScore * 0.3) + (interviewScore * 0.2));
  const decision = weighted >= 75 ? "Apply" : weighted >= 55 ? "Prepare" : "Hold";
  const companies = [
    { name: "CodeOrbit", role: "Backend Developer", required: ["Node", "Express", "MongoDB", "SQL"] },
    { name: "PixelForge", role: "Frontend Developer", required: ["React", "TypeScript", "CSS", "REST API"] },
    { name: "DataSphere", role: "Data Analyst", required: ["Python", "SQL", "Statistics", "Excel"] },
  ];
  const extracted = new Set((analysis?.extractedSkills || []).map((item) => String(item).toLowerCase()));
  const rows = companies.map((company) => {
    const matched = company.required.filter((skill) => extracted.has(skill.toLowerCase())).length;
    const fit = Math.round((matched / company.required.length) * 100);
    const state = fit >= 70 && decision === "Apply" ? "Apply" : fit >= 50 ? "Prepare" : "Hold";
    return { ...company, fit, state };
  });
  const topGaps = (analysis?.missingSkills || []).slice(0, 5);
  const strongest = (analysis?.matchedSkills || []).slice(0, 5);
  const decisionTone = decision === "Apply"
    ? "text-emerald-700"
    : decision === "Prepare"
      ? "text-amber-700"
      : "text-rose-700";
  const scoreTone = getScoreTextClass(score, 49);
  const claimScoreTone = getScoreTextClass(claimScore, 49);
  const interviewScoreTone = getScoreTextClass(interviewScore, 49);
  const weightedTone = getScoreTextClass(weighted, 49);
  const focusPlan = [
    { day: "Day 1", work: "ATS cleanup", detail: "Fix headline, summary, and keyword alignment for role search systems." },
    { day: "Day 2", work: "Proof depth", detail: "Add measurable numbers in two strongest projects and one impact bullet." },
    { day: "Day 3", work: "Skill gap patch", detail: `Target top gaps: ${topGaps.join(", ") || "No critical gaps detected"}.` },
    { day: "Day 4", work: "Interview story prep", detail: "Create STAR-based stories for architecture, debugging, and collaboration." },
    { day: "Day 5", work: "Final apply pass", detail: "Run one final scoring pass and shortlist high-fit companies only." },
  ];

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Application Readiness Engine</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl text-slate-900">Company-wise Apply Decision</h1>
          </div>
          <div className="editorial-strip p-6">
            <p className="mt-3 max-w-3xl text-base text-slate-600">
              Role target: <span className="font-semibold text-slate-800">{selectedRole}</span>. This page combines resume quality,
              proof-test authenticity, and interview confidence to tell you where to apply now and where to prepare first.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className={`editorial-strip p-5 ${score >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
              <p className="text-sm text-slate-500">Resume Score</p>
              <p className={`text-3xl font-bold ${scoreTone}`}>{score}%</p>
              <p className="mt-2 text-xs text-slate-500">Weight: 50%</p>
            </div>
            <div className={`editorial-strip p-5 ${claimScore >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
              <p className="text-sm text-slate-500">Proof Score</p>
              <p className={`text-3xl font-bold ${claimScoreTone}`}>{claimScore}%</p>
              <p className="mt-2 text-xs text-slate-500">Weight: 30%</p>
            </div>
            <div className={`editorial-strip p-5 ${interviewScore >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
              <p className="text-sm text-slate-500">Interview Signal</p>
              <p className={`text-3xl font-bold ${interviewScoreTone}`}>{interviewScore}%</p>
              <p className="mt-2 text-xs text-slate-500">Weight: 20%</p>
            </div>
            <div className={`editorial-strip p-5 ${weighted >= 49 ? "border border-emerald-200 bg-emerald-50/50" : "border border-rose-200 bg-rose-50/40"}`}>
              <p className={`text-sm ${weightedTone}`}>Final Decision ({weighted}%)</p>
              <p className={`text-3xl font-bold ${decisionTone}`}>{decision}</p>
              <p className="mt-2 text-xs text-slate-500">Apply: 75+ | Prepare: 55-74 | Hold: below 55</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="editorial-strip p-5">
              <p className="text-sm font-semibold text-slate-700">Strongest Signals</p>
              <div className="mt-3 space-y-2">
                {(strongest.length ? strongest : ["No matched skill signal yet"]).map((item) => (
                  <p key={item} className="text-sm text-slate-700">{item}</p>
                ))}
              </div>
            </div>
            <div className="editorial-strip p-5">
              <p className="text-sm font-semibold text-slate-700">Critical Gaps Before High-Stakes Apply</p>
              <div className="mt-3 space-y-2">
                {(topGaps.length ? topGaps : ["No major gap detected"]).map((item) => (
                  <p key={item} className="text-sm text-slate-700">{item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto border border-slate-200 bg-white">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200 text-sm text-slate-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Fit</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-slate-800">{row.name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.role}</td>
                    <td className={`px-4 py-3 ${getScoreTextClass(row.fit, 49)}`}>{row.fit}%</td>
                    <td className="px-4 py-3 text-slate-800">{row.state}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {row.state === "Apply" ? "Submit now with current resume." : row.state === "Prepare" ? "Fix 2 gap keywords then apply." : "Hold and rebuild key evidence first."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 editorial-strip p-6">
            <p className="text-sm font-semibold text-slate-700">5-Day Readiness Sprint</p>
            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {focusPlan.map((item) => (
                <div key={item.day} className="grid gap-2 py-3 md:grid-cols-[120px_170px_1fr]">
                  <p className="text-sm font-semibold text-slate-800">{item.day}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.work}</p>
                  <p className="text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewLoopPage() {
  const analysis = getStoredAnalysisResult();
  const missing = analysis?.missingSkills || [];
  const topMissing = missing.slice(0, 6);
  const suggestions = missing.slice(0, 5).map((skill) => ({
    weak: `${skill} interview confidence low`,
    resumeFix: `Add one quantified bullet showing ${skill} in action.`,
    projectFix: `Build mini project proving ${skill} depth.`,
  }));
  const loopFlow = [
    "Interview reveals weak area",
    "Convert weak area into resume bullet",
    "Attach project proof",
    "Retest through mock interview",
    "Promote section to final resume version",
  ];
  const defaultSuggestions = [{
    weak: "No high-priority weak area detected",
    resumeFix: "Maintain current resume structure and keep metrics updated.",
    projectFix: "Continue role-aligned project depth for stronger interview proof.",
  }];

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interview-to-Resume Loop</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl text-slate-900">Turn Weak Answers into Strong Resume Proof</h1>
          </div>
          <div className="editorial-strip p-6">
            <p className="mt-3 max-w-3xl text-base text-slate-600">
              This flow closes the gap between interview performance and resume quality. Every weak area becomes a concrete resume
              improvement plus a project-backed proof signal.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="editorial-strip p-5">
              <p className="text-sm text-slate-500">Detected Weak Skills</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{topMissing.length}</p>
            </div>
            <div className="editorial-strip p-5 md:col-span-2">
              <p className="text-sm font-semibold text-slate-700">Priority Queue</p>
              <p className="mt-2 text-sm text-slate-600">
                {topMissing.length ? topMissing.join(", ") : "No immediate weak skills. Focus on depth and consistency."}
              </p>
            </div>
          </div>

          <div className="mt-6 editorial-strip p-6">
            <p className="text-sm font-semibold text-slate-700">Loop Execution Flow</p>
            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {loopFlow.map((item, idx) => (
                <div key={item} className="grid gap-2 py-3 md:grid-cols-[64px_1fr]">
                  <p className="text-sm font-semibold text-slate-500">Step {idx + 1}</p>
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {(suggestions.length ? suggestions : defaultSuggestions).map((item, idx) => (
              <div key={`${item.weak}-${idx}`} className="editorial-strip p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Weak Signal {String(idx + 1).padStart(2, "0")}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{item.weak}</p>
                <div className="mt-4 grid gap-0 border border-slate-200 md:grid-cols-2">
                  <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
                    <p className="text-sm font-semibold text-slate-700">Resume Fix</p>
                    <p className="mt-1 text-sm text-slate-600">{item.resumeFix}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-slate-700">Project Fix</p>
                    <p className="mt-1 text-sm text-slate-600">{item.projectFix}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 editorial-strip p-6">
            <p className="text-sm font-semibold text-slate-700">Weekly Review Rule</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              If the same weak skill appears in two interview rounds, you must update both resume and project evidence before next
              application batch. This prevents repeating the same rejection pattern.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadmapBuilderPage() {
  const domainList = Object.keys(ROLE_SKILL_MAP);
  const companyMap = {
    "Frontend Developer": [
      "Google", "Microsoft", "Amazon", "Adobe", "Atlassian",
      "Vercel", "Razorpay", "CRED", "Swiggy", "Meesho",
      "Flipkart", "Paytm", "Groww", "PhonePe", "Zomato",
    ],
    "Backend Developer": [
      "Google", "Microsoft", "Amazon", "Meta", "Netflix",
      "Stripe", "Postman", "Razorpay", "PhonePe", "Paytm",
      "Swiggy", "Zomato", "CRED", "Meesho", "Flipkart",
    ],
    "Data Analyst": [
      "Google", "Microsoft", "Amazon", "Deloitte", "EY",
      "KPMG", "Accenture", "Fractal", "NielsenIQ", "Mu Sigma",
      "Meesho", "Flipkart", "Swiggy", "Zomato", "Paytm",
    ],
    "Full Stack Developer": [
      "Google", "Microsoft", "Amazon", "Zoho", "Freshworks",
      "Postman", "Razorpay", "CRED", "Swiggy", "Meesho",
      "Flipkart", "Paytm", "Groww", "PhonePe", "Zomato",
    ],
  };
  const [domain, setDomain] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const topTierCompanies = new Set(["Google", "Microsoft", "Amazon", "Meta", "Netflix", "Adobe", "Atlassian", "Stripe"]);
  const midTierCompanies = new Set(["Razorpay", "Postman", "PhonePe", "Paytm", "CRED", "Swiggy", "Zomato", "Flipkart", "Meesho", "Groww", "Zoho", "Freshworks"]);
  const baseSkills = domain ? (ROLE_SKILL_MAP[domain] || []) : [];
  const companySkills = baseSkills.slice(0, 4);
  const totalWeeks = !company
    ? 0
    : topTierCompanies.has(company)
      ? 10
      : midTierCompanies.has(company)
        ? 8
        : 6;
  const weeklyTemplates = domain && company ? [
    {
      title: "Foundation Setup",
      tasks: [
        `Set up ${domain} learning stack and weekly calendar`,
        "Create Git workflow, repo standards, and branch strategy",
        `Ship starter build using ${baseSkills[0] || "core fundamentals"}`,
      ],
    },
    {
      title: "Core Build Sprint",
      tasks: [
        `Implement deep feature using ${baseSkills[1] || baseSkills[0] || "core skill"}`,
        "Refactor architecture and enforce lint/test checks",
        "Deploy v1 and write technical README with setup guide",
      ],
    },
    {
      title: "Skill Expansion",
      tasks: [
        `Build focused modules for ${companySkills.slice(0, 2).join(" and ") || "core stack"}`,
        "Add input validation, error states, and logging",
        "Record before/after performance and stability notes",
      ],
    },
    {
      title: "Production Readiness",
      tasks: [
        `Integrate ${companySkills[2] || companySkills[0] || "stack"} into end-to-end workflow`,
        "Add tests for edge cases and critical paths",
        "Prepare deployment + rollback checklist",
      ],
    },
    {
      title: "Company Alignment",
      tasks: [
        `Study ${company} role expectations and engineering culture`,
        "Map JD requirements to your project proofs",
        "Identify top 3 gaps and assign fixes",
      ],
    },
    {
      title: "Resume Upgrade",
      tasks: [
        "Rewrite summary and experience for target role",
        `Inject role keywords: ${baseSkills.slice(0, 4).join(", ")}`,
        "Create 3 quantified impact bullets from shipped work",
      ],
    },
    {
      title: "Interview Preparation",
      tasks: [
        "Prepare 20 technical questions with concise answers",
        "Build project walkthrough narrative: problem -> tradeoff -> impact",
        "Run mock interview round 1 and capture weak points",
      ],
    },
    {
      title: "Feedback Loop",
      tasks: [
        "Patch weak answers into resume/project evidence",
        "Run mock interview round 2 under time pressure",
        "Finalize concise STAR stories for behavior rounds",
      ],
    },
    {
      title: "Application Wave 1",
      tasks: [
        `Apply to ${company} and top matching peers`,
        "Send referral and hiring-manager outreach with portfolio links",
        "Track responses in apply board and classify outcomes",
      ],
    },
    {
      title: "Optimization + Wave 2",
      tasks: [
        "Analyze rejection/interview feedback patterns",
        "Improve resume sections with low response rate",
        "Launch second application wave with updated profile",
      ],
    },
  ] : [];
  const weeklyRoadmap = weeklyTemplates.slice(0, totalWeeks).map((template, idx) => ({
    week: `Week ${idx + 1}`,
    title: template.title,
    tasks: template.tasks,
  }));
  const roadmapPage1 = weeklyRoadmap;

  useEffect(() => {
    if (!domain) {
      setCompany("");
      return;
    }
    const nextCompanies = companyMap[domain] || [];
    if (!nextCompanies.includes(company)) {
      setCompany("");
    }
  }, [domain]);

  const handleGenerateRoadmap = () => {
    if (!domain || !company) return;
    setSubmitted(true);
  };

  return (
    <div className="analyze-bg analyze-flat ats-flat min-h-screen">
      <div className="w-full">
        <WorkspaceSidebar />
        <div className="stagger-auto workspace-content min-h-screen px-4 py-5 md:px-6 md:py-7 lg:ml-[256px] lg:pl-6 lg:pr-8">
          <WorkspaceTopbar />
          <PageExportActions className="mb-4" />
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Roadmap Builder</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl text-slate-900">0 to Job Roadmap</h1>
          </div>
          <div className="editorial-strip p-6">
            <p className="mt-2 text-base text-slate-600">Select domain and company, then follow this execution roadmap.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Domain</p>
                <input
                  list="roadmap-domains"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value);
                    setSubmitted(false);
                  }}
                  className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Search domain..."
                />
                <datalist id="roadmap-domains">
                  {domainList.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target Company</p>
                <input
                  list="roadmap-companies"
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    setSubmitted(false);
                  }}
                  className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  disabled={!domain}
                  placeholder="Search company..."
                />
                <datalist id="roadmap-companies">
                  {(companyMap[domain] || []).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>
            <button
              onClick={handleGenerateRoadmap}
              disabled={!domain || !company}
              className="mt-4 rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
            >
              Generate Roadmap
            </button>
          </div>

          {submitted ? (
            <>
              <section className="mt-6 grid min-h-[calc(100vh-2rem)] w-full content-start gap-5 border border-slate-200 bg-white p-8 md:grid-cols-4">
                <div className="editorial-strip p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Timeline</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{totalWeeks} Weeks</p>
                </div>
                <div className="editorial-strip p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Core Skills</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{baseSkills.length}</p>
                </div>
                <div className="editorial-strip p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Target</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{company}</p>
                </div>
                <div className="editorial-strip p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Outcome</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">Apply Ready</p>
                </div>
                <div className="md:col-span-4 divide-y divide-slate-200 border-y border-slate-200">
                  {roadmapPage1.map((item) => (
                    <div key={item.week} className="grid gap-4 py-4 md:grid-cols-[140px_240px_1fr]">
                      <p className="text-base font-semibold text-slate-800">{item.week}</p>
                      <p className="text-base font-semibold text-slate-700">{item.title}</p>
                      <div className="space-y-1">
                        {item.tasks.map((task) => (
                          <p key={task} className="text-base text-slate-600">{task}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="md:col-span-4 grid gap-4 md:grid-cols-2">
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Weekly Output Target</p>
                    <p className="mt-2 text-base text-slate-600">Minimum 12-15 focused hours every week with 1 deployable output.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Consistency Rule</p>
                    <p className="mt-2 text-base text-slate-600">If one week slips, extend final phase by one week before applying.</p>
                  </div>
                </div>
              </section>

              <section className="mt-0 grid min-h-[calc(100vh-2rem)] w-full content-start gap-5 border border-slate-200 border-t-0 bg-white p-8">
                <h2 className="text-3xl font-bold text-slate-900">Project + Portfolio Plan</h2>
                <p className="text-base text-slate-600">Build 3 projects aligned to {domain} hiring signals for {company}.</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Project 1: Core App</p>
                    <p className="mt-2 text-base text-slate-600">One production-style project focused on {baseSkills[0] || "fundamentals"} and clean architecture.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Project 2: Scale Feature</p>
                    <p className="mt-2 text-base text-slate-600">Add performance, edge-case handling, tests, and deployment notes.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Project 3: Company-style Case</p>
                    <p className="mt-2 text-base text-slate-600">Create one problem statement similar to {company} and ship a full solution.</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  {["README with architecture diagram", "Live demo + short walkthrough video", "Impact metrics: latency, throughput, accuracy", "Document tradeoffs and future improvements"].map((item) => (
                    <p key={item} className="py-3 text-base text-slate-700">{item}</p>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Milestone Checks</p>
                    <p className="mt-2 text-sm text-slate-600">End each week with deployed build, code cleanup, and changelog update.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Proof Assets</p>
                    <p className="mt-2 text-sm text-slate-600">Keep screenshots, demo links, and architecture notes ready for interviews.</p>
                  </div>
                </div>
                <div className="editorial-strip p-4">
                  <p className="text-sm font-semibold text-slate-800">Review Gate</p>
                  <p className="mt-2 text-sm text-slate-600">Before moving phase, ensure project quality, readability, and one measurable result is documented.</p>
                </div>
              </section>

              <section className="mt-0 grid min-h-[calc(100vh-2rem)] w-full content-start gap-5 border border-slate-200 border-t-0 bg-white p-8">
                <h2 className="text-3xl font-bold text-slate-900">Resume + Interview Preparation</h2>
                <p className="text-base text-slate-600">Translate work into recruiter language and interview-ready stories.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Resume Rewrite Checklist</p>
                    <div className="mt-2 space-y-2">
                      <p className="text-base text-slate-600">Use domain keywords: {baseSkills.slice(0, 5).join(", ")}</p>
                      <p className="text-base text-slate-600">Every bullet must contain action + metric + impact.</p>
                      <p className="text-base text-slate-600">Customize summary for {company} role expectations.</p>
                    </div>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Interview Drill Plan</p>
                    <div className="mt-2 space-y-2">
                      <p className="text-base text-slate-600">Prepare 10 technical Q&A around core stack.</p>
                      <p className="text-base text-slate-600">Prepare 5 STAR stories for ownership and problem-solving.</p>
                      <p className="text-base text-slate-600">Run 3 mock interviews and refine weak answers.</p>
                    </div>
                  </div>
                </div>
                <div className="editorial-strip p-4">
                  <p className="text-base font-semibold text-slate-800">Weekly Review System</p>
                  <p className="mt-2 text-base text-slate-600">End of each week: re-score resume, compare gaps, and update next-week tasks before applying.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Mock Round 1</p>
                    <p className="mt-2 text-sm text-slate-600">Focus on basics, coding flow, and communication clarity.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Mock Round 2</p>
                    <p className="mt-2 text-sm text-slate-600">Go deep on projects, tradeoffs, and failure handling.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Mock Round 3</p>
                    <p className="mt-2 text-sm text-slate-600">Final pressure simulation with timed answers.</p>
                  </div>
                </div>
              </section>

              <section className="mt-0 grid min-h-[calc(100vh-2rem)] w-full content-start gap-5 border border-slate-200 border-t-0 bg-white p-8">
                <h2 className="text-3xl font-bold text-slate-900">Apply Execution Calendar</h2>
                <p className="text-base text-slate-600">Final page: application wave plan for {company} and similar companies.</p>
                <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                  {[
                    "Day 1: Final ATS pass, resume freeze, LinkedIn headline update.",
                    `Day 2: Apply to ${company} + 3 similar companies with tailored bullets.`,
                    "Day 3: Send referral/outreach messages with portfolio links.",
                    "Day 4: Practice round-1 interview questions and system walkthrough.",
                    "Day 5: Track responses, iterate resume based on rejections/interview feedback.",
                  ].map((step, idx) => (
                    <div key={step} className="grid gap-2 py-3 md:grid-cols-[110px_1fr]">
                      <p className="text-base font-semibold text-slate-800">Step {idx + 1}</p>
                      <p className="text-base text-slate-600">{step}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Tracking Board</p>
                    <p className="mt-2 text-sm text-slate-600">Track status as Applied, OA, Interview, Hold, Rejected.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-sm font-semibold text-slate-800">Iteration Rule</p>
                    <p className="mt-2 text-sm text-slate-600">After every 10 applications, revise resume and outreach template once.</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Weekly Output Target</p>
                    <p className="mt-2 text-base text-slate-600">Minimum 12-15 focused hours every week with 1 deployable output.</p>
                  </div>
                  <div className="editorial-strip p-4">
                    <p className="text-base font-semibold text-slate-800">Consistency Rule</p>
                    <p className="mt-2 text-base text-slate-600">If one week slips, extend final phase by one week before applying.</p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="mt-6 border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
              Select domain and company, then click <span className="font-semibold text-slate-800">Generate Roadmap</span> to view full plan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeClassSync({ isDark }) {
  const location = useLocation();

  useEffect(() => {
    const isLanding = location.pathname === "/";
    document.documentElement.classList.toggle("theme-dark", !isLanding && isDark);
  }, [isDark, location.pathname]);

  return null;
}

function RouteScrollReset() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

function App() {
  const [isDark, setIsDark] = useState(() => appState.getTheme());
  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      appState.setTheme(next);
      return next;
    });
  };
  useEffect(() => {
    appState.setTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry?.type === "reload") {
      appState.clearAnalysisResult();
      appState.clearFallbackResult();
      appState.clearClaimResult();
      appState.clearInterviewResult();
      localStorage.removeItem(ANALYSIS_META_KEY);
      localStorage.removeItem(ANALYSIS_DURATION_KEY);
      localStorage.removeItem(ANALYSIS_HISTORY_KEY);
      appState.setJdDetected(false);
      SESSION_UPLOADED_RESUME_FILE = null;
      SESSION_UPLOADED_RESUME_NAME = "";
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark, toggleTheme }}>
      <BrowserRouter>
        <ThemeClassSync isDark={isDark} />
        <RouteScrollReset />
        <div>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/ats-checker" element={<ProtectedWorkspaceRoute><AtsCheckerPage /></ProtectedWorkspaceRoute>} />
            <Route path="/role-match" element={<ProtectedWorkspaceRoute><RoleMatchPage /></ProtectedWorkspaceRoute>} />
            <Route path="/missing-skills" element={<ProtectedWorkspaceRoute><MissingSkillsPage /></ProtectedWorkspaceRoute>} />
            <Route path="/icm-score" element={<ProtectedWorkspaceRoute><IcmScorePage /></ProtectedWorkspaceRoute>} />
            <Route path="/roadmap-builder" element={<ProtectedWorkspaceRoute><RoadmapBuilderPage /></ProtectedWorkspaceRoute>} />
            <Route path="/reports" element={<ProtectedWorkspaceRoute><ReportsPage /></ProtectedWorkspaceRoute>} />
            <Route path="/settings" element={<ProtectedWorkspaceRoute><SettingsPage /></ProtectedWorkspaceRoute>} />
            <Route path="/application-readiness" element={<ProtectedWorkspaceRoute><ApplicationReadinessPage /></ProtectedWorkspaceRoute>} />
            <Route path="/interview-loop" element={<ProtectedWorkspaceRoute><InterviewLoopPage /></ProtectedWorkspaceRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

export default App;
