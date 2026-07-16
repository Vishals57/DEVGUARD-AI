import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldAlert, 
  Gauge, 
  Code2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  RefreshCw, 
  Send, 
  Trash2, 
  Copy, 
  Sparkles, 
  Lightbulb, 
  BookOpen, 
  Terminal, 
  ArrowRight, 
  FileText, 
  Sliders,
  Check,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Lock,
  Cpu,
  History,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SAMPLE_CODES } from "./samples";
import { AuditReport, Issue, ChatMessage, SavedAuditSession } from "./types";
import { highlightCode } from "./utils/highlighter";

export default function App() {
  // Editor State
  const [code, setCode] = useState<string>(SAMPLE_CODES[0].content);
  const [isDiff, setIsDiff] = useState<boolean>(SAMPLE_CODES[0].isDiff);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_CODES[0].id);
  const [strictness, setStrictness] = useState<"casual" | "standard" | "paranoid">("standard");
  const [categories, setCategories] = useState<string[]>(["SECURITY", "PERFORMANCE", "QUALITY"]);

  // Audit Status
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active UI filters/selectors
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedIssues, setExpandedIssues] = useState<Record<number, boolean>>({});

  // Chat State
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Editor Scroll & Highlighting Refs
  const [syntaxHighlightEnabled, setSyntaxHighlightEnabled] = useState<boolean>(true);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorPreRef = useRef<HTMLPreElement>(null);

  const handleEditorScroll = () => {
    if (editorTextareaRef.current && editorPreRef.current) {
      editorPreRef.current.scrollTop = editorTextareaRef.current.scrollTop;
      editorPreRef.current.scrollLeft = editorTextareaRef.current.scrollLeft;
    }
  };

  // Sync scroll positions when code content changes (e.g., typing, pasting, sample loaded)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorTextareaRef.current && editorPreRef.current) {
        editorPreRef.current.scrollTop = editorTextareaRef.current.scrollTop;
        editorPreRef.current.scrollLeft = editorTextareaRef.current.scrollLeft;
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [code]);

  // Recent Audits State
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [recentAudits, setRecentAudits] = useState<SavedAuditSession[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);

  // Load recent audits on mount
  useEffect(() => {
    try {
      const existingJson = localStorage.getItem("devguard_recent_audits");
      if (existingJson) {
        setRecentAudits(JSON.parse(existingJson));
      }
    } catch (err) {
      console.warn("Failed to load recent audits from localStorage:", err);
    }
  }, []);

  // API Availability Check
  const [backendConfigured, setBackendConfigured] = useState<boolean>(true);

  // Extract a readable name or preview for the audit session
  const getAuditTitle = (codeToAnalyze: string, isDiffMode: boolean, parsedReport?: AuditReport) => {
    const matchedSample = SAMPLE_CODES.find((s) => s.content.trim() === codeToAnalyze.trim());
    if (matchedSample) return matchedSample.name;

    if (isDiffMode) {
      const gitFileRegex = /diff --git a\/(.*?) b\//;
      const match = codeToAnalyze.match(gitFileRegex);
      if (match && match[1]) {
        return `Diff: ${match[1].split("/").pop()}`;
      }
    }

    const classRegex = /(?:class|interface|enum)\s+(\w+)/;
    const classMatch = codeToAnalyze.match(classRegex);
    if (classMatch && classMatch[1]) {
      return `${classMatch[1]}.java`;
    }

    if (parsedReport && parsedReport.issues && parsedReport.issues.length > 0) {
      const firstPath = parsedReport.issues[0].filePath;
      if (firstPath) {
        return firstPath.split("/").pop() || firstPath;
      }
    }

    return "Custom Code Snippet";
  };

  // Save successful audit session to localStorage (max 5)
  const saveAuditSession = (
    codeStr: string,
    isDiffMode: boolean,
    reportData: AuditReport,
    initialChat: ChatMessage[],
    generatedId: string
  ) => {
    try {
      const title = getAuditTitle(codeStr, isDiffMode, reportData);
      const newSession: SavedAuditSession = {
        id: generatedId,
        timestamp: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        title,
        code: codeStr,
        isDiff: isDiffMode,
        report: reportData,
        chatMessages: initialChat,
      };

      const existingJson = localStorage.getItem("devguard_recent_audits");
      let sessions: SavedAuditSession[] = [];
      if (existingJson) {
        sessions = JSON.parse(existingJson);
      }

      // Filter out any older session with the exact same code to avoid duplicate entries
      sessions = sessions.filter((s) => s.code.trim() !== codeStr.trim());

      sessions.unshift(newSession);

      if (sessions.length > 5) {
        sessions = sessions.slice(0, 5);
      }

      localStorage.setItem("devguard_recent_audits", JSON.stringify(sessions));
      setRecentAudits(sessions);
    } catch (err) {
      console.warn("Failed to save audit to localStorage:", err);
    }
  };

  // Update saved session chats when conversation continues
  const updateSavedSessionChat = (sessionId: string, updatedMessages: ChatMessage[]) => {
    try {
      const existingJson = localStorage.getItem("devguard_recent_audits");
      if (!existingJson) return;
      let sessions: SavedAuditSession[] = JSON.parse(existingJson);
      const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].chatMessages = updatedMessages;
        localStorage.setItem("devguard_recent_audits", JSON.stringify(sessions));
        setRecentAudits(sessions);
      }
    } catch (err) {
      console.warn("Failed to update chat in localStorage:", err);
    }
  };

  // Load a session from history
  const loadAuditSession = (session: SavedAuditSession) => {
    setCode(session.code);
    setIsDiff(session.isDiff);

    const matchedSample = SAMPLE_CODES.find((s) => s.content.trim() === session.code.trim());
    if (matchedSample) {
      setSelectedSampleId(matchedSample.id);
    } else {
      setSelectedSampleId("");
    }

    setReport(session.report);
    setChatMessages(session.chatMessages);
    setLoadedSessionId(session.id);

    // Auto expand some issues
    const initialExpanded: Record<number, boolean> = {};
    session.report.issues.forEach((_, idx) => {
      if (idx < 2) initialExpanded[idx] = true;
    });
    setExpandedIssues(initialExpanded);

    setChatOpen(session.chatMessages.length > 0);
    setSidebarOpen(false);
    showToast(`Loaded cached session for "${session.title}"`);
  };

  // Delete a session from history
  const deleteAuditSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const existingJson = localStorage.getItem("devguard_recent_audits");
      if (!existingJson) return;
      let sessions: SavedAuditSession[] = JSON.parse(existingJson);
      sessions = sessions.filter((s) => s.id !== sessionId);
      localStorage.setItem("devguard_recent_audits", JSON.stringify(sessions));
      setRecentAudits(sessions);
      if (loadedSessionId === sessionId) {
        setLoadedSessionId(null);
      }
      showToast("Audit session removed from cache.", "info");
    } catch (err) {
      console.warn("Failed to delete audit session:", err);
    }
  };

  // Auto scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  // Load sample code
  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_CODES.find((s) => s.id === sampleId);
    if (sample) {
      setCode(sample.content);
      setIsDiff(sample.isDiff);
      setSelectedSampleId(sampleId);
      setReport(null);
      setError(null);
      // Pre-expand first issue when generating a report
      setExpandedIssues({});
    }
  };

  // Run Code Review
  const runAudit = async () => {
    if (!code.trim()) {
      setError("Please paste some Java code or a Git Diff before running the audit.");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    const steps = [
      "Establishing connection to secure analysis sandbox...",
      "Parsing Java syntax trees and import scopes...",
      "Running security vector scanning for secrets & injection risks...",
      "Analyzing stream lifecycles & database connection maps...",
      "Evaluating JPA fetch plans and N+1 query structures...",
      "Generating Remediation Code blocks and Scoring indexes...",
      "Wrapping up auditor findings report..."
    ];

    let stepIndex = 0;
    setLoadingStep(steps[0]);

    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingStep(steps[stepIndex]);
    }, 1800);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          isDiff,
          strictness,
          categories
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error status: ${response.status}`);
      }

      const data: AuditReport = await response.json();
      setReport(data);
      
      // Auto-expand the first couple of issues for pleasant user interaction
      const initialExpanded: Record<number, boolean> = {};
      data.issues.forEach((_, idx) => {
        if (idx < 2) initialExpanded[idx] = true;
      });
      setExpandedIssues(initialExpanded);

      const generatedSessionId = Math.random().toString(36).substring(2, 9);
      setLoadedSessionId(generatedSessionId);

      // Initialize chat with a welcome from DevGuard about this specific code
      const welcomeMsg: ChatMessage = {
        id: "welcome",
        role: "model",
        content: `Hello! I have completed my audit of your code. I graded your security at **${data.securityScore}/100**, performance at **${data.performanceScore}/100**, and quality at **${data.qualityScore}/100**.

I found **${data.issues.length} findings** that require attention, including **${data.issues.filter(i => i.severity === "CRITICAL" || i.severity === "HIGH").length} high-severity risks**. 

Feel free to ask me questions like:
- *"How does the resource leak on the FileInputStream occur?"*
- *"Can we rewrite this Spring controller to be safe under heavy multi-threaded loads?"*
- *"Show me how to use Spring's NamedParameterJdbcTemplate to fix the SQL Injection."*`,
        timestamp: new Date().toLocaleTimeString()
      };

      const initialChat = [welcomeMsg];
      setChatMessages(initialChat);
      setChatOpen(true);

      // Save to recent audits
      saveAuditSession(code, isDiff, data, initialChat, generatedSessionId);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected network error occurred while reaching the auditor backend.");
      if (err.message?.includes("GEMINI_API_KEY")) {
        setBackendConfigured(false);
      }
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  // Chat conversation
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsgText = chatInput;
    setChatInput("");
    setError(null);

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString()
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    if (loadedSessionId) {
      updateSavedSessionChat(loadedSessionId, nextMessages);
    }
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          isDiff,
          issues: report?.issues || [],
          history: chatMessages,
          message: userMsgText
        })
      });

      if (!response.ok) {
        throw new Error("Unable to fetch reply from DevGuard AI server.");
      }

      const data = await response.json();
      
      const replyMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "model",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString()
      };

      const finalMessages = [...nextMessages, replyMessage];
      setChatMessages(finalMessages);
      if (loadedSessionId) {
        updateSavedSessionChat(loadedSessionId, finalMessages);
      }

    } catch (err: any) {
      console.error(err);
      const errorMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "model",
        content: "🚨 **Error from DevGuard AI:** I encountered an issue processing your question. Please verify your GEMINI_API_KEY and server connectivity.",
        timestamp: new Date().toLocaleTimeString()
      };

      const finalErrMessages = [...nextMessages, errorMessage];
      setChatMessages(finalErrMessages);
      if (loadedSessionId) {
        updateSavedSessionChat(loadedSessionId, finalErrMessages);
      }
    } finally {
      setChatLoading(false);
    }
  };

  // Toggle single category filter selection
  const handleToggleCategorySelection = (category: string) => {
    if (categories.includes(category)) {
      if (categories.length > 1) {
        setCategories(categories.filter(c => c !== category));
      }
    } else {
      setCategories([...categories, category]);
    }
  };

  // Code Remediation Surgical Fix Injector
  const applyRemediation = (issue: Issue, index: number) => {
    // Attempt to surgically replace beforeCode with afterCode in our editor
    const cleanedBefore = issue.beforeCode.trim();
    const cleanedAfter = issue.afterCode.trim();

    if (code.includes(cleanedBefore)) {
      const updatedCode = code.replace(cleanedBefore, cleanedAfter);
      setCode(updatedCode);
      showToast(`Surgically patched: "${issue.title}". Run Code Audit again to verify your score!`);
      
      // Close this issue accordion or mark it as applied
      setExpandedIssues(prev => ({ ...prev, [index]: false }));
    } else {
      // Fallback: If exact whitespace/formatting mismatch, replace best match or alert user to copy
      // Let's do a loose replacement by removing tabs/spaces for matching
      const escapedBefore = cleanedBefore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const normalizedBefore = cleanedBefore.replace(/\s+/g, "");
      
      // Look for code match ignoring general whitespace differences
      let replacedLoose = false;
      
      // If we can't replace automatically, we guide them
      navigator.clipboard.writeText(cleanedAfter);
      showToast(`Remediation copied to clipboard! Formatting prevented auto-patch. Paste it directly over the flagged lines.`, "info");
    }
  };

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // Copy code from the editor
  const copyEditorCode = () => {
    navigator.clipboard.writeText(code);
    showToast("Editor content copied to clipboard!");
  };

  // Get severity style
  const getSeverityStyle = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return {
          bg: "bg-red-950/40 border-red-500/40 text-red-400",
          badge: "bg-red-500 text-white font-semibold",
          indicator: "bg-red-500"
        };
      case "HIGH":
        return {
          bg: "bg-orange-950/40 border-orange-500/40 text-orange-400",
          badge: "bg-orange-500 text-white font-semibold",
          indicator: "bg-orange-500"
        };
      case "MEDIUM":
        return {
          bg: "bg-yellow-950/40 border-yellow-500/40 text-yellow-300",
          badge: "bg-yellow-600 text-slate-900 font-semibold",
          indicator: "bg-yellow-500"
        };
      default:
        return {
          bg: "bg-blue-950/40 border-blue-500/40 text-blue-300",
          badge: "bg-blue-600 text-white font-semibold",
          indicator: "bg-blue-500"
        };
    }
  };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-500";
  };

  // Score circle radius/dash calculations
  const calculateDashOffset = (score: number, radius = 40) => {
    const circumference = 2 * Math.PI * radius;
    return circumference - (score / 100) * circumference;
  };

  // Filtering issues list
  const filteredIssues = report?.issues.filter(issue => {
    const matchCat = selectedCategoryFilter === "ALL" || issue.category === selectedCategoryFilter;
    const matchSev = selectedSeverityFilter === "ALL" || issue.severity === selectedSeverityFilter;
    const matchQuery = !searchQuery || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSev && matchQuery;
  }) || [];

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-[#0c0c0d] border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 rounded-xl"
            id="notification-toast"
          >
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secrets warning modal */}
      {!backendConfigured && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-200 text-xs py-2 px-4 flex items-center justify-between gap-3 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span><strong>Missing API Key:</strong> The server-side Gemini client failed to initialize. Please configure your <strong>GEMINI_API_KEY</strong> in the Secrets menu of AI Studio.</span>
          </div>
          <button 
            onClick={() => setBackendConfigured(true)}
            className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-[10px] uppercase tracking-wider font-bold"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Layout Header */}
      <header className="border-b border-white/5 bg-[#050505]/80 backdrop-blur sticky top-0 z-30 ui-blur" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/10">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-semibold text-lg tracking-wider uppercase">
                  DevGuard <span className="text-indigo-400">AI</span>
                </h1>
                <span className="text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  v1.2.0
                </span>
              </div>
              <p className="text-xs text-white/40 uppercase tracking-widest font-mono">
                Senior Java Tech Lead & Security Auditor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/40">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Auditor Core: Active</span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-mono text-white/40 shrink-0 uppercase tracking-wider" htmlFor="sample-selector">Test Case:</label>
              <select
                id="sample-selector"
                value={selectedSampleId}
                onChange={(e) => handleSelectSample(e.target.value)}
                className="w-full sm:w-56 bg-[#0c0c0d] border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 text-xs rounded-lg px-3 py-1.5 font-medium text-white/80 outline-none"
              >
                {SAMPLE_CODES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 rounded-lg text-xs font-mono uppercase tracking-wider text-white/80 transition shrink-0"
              title="Recent Audits"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>History ({recentAudits.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6" id="main-content">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT SIDE: Active Editor & Audit Scope Configuration (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-5" id="workspace-section">
            <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-mono font-medium text-xs uppercase tracking-widest text-white/80">
                    Source Workspace
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSyntaxHighlightEnabled(prev => !prev)}
                    title={syntaxHighlightEnabled ? "Disable Syntax Highlighting" : "Enable Syntax Highlighting"}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition ${
                      syntaxHighlightEnabled
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
                        : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/80"
                    }`}
                  >
                    {syntaxHighlightEnabled ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{syntaxHighlightEnabled ? "Syntax On" : "Syntax Off"}</span>
                  </button>
                  <button
                    onClick={copyEditorCode}
                    title="Copy Code"
                    className="p-1.5 hover:bg-white/5 text-white/40 hover:text-white rounded transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCode("")}
                    title="Clear Workspace"
                    className="p-1.5 hover:bg-white/5 text-white/40 hover:text-red-400 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editor TextArea with Line numbers and Syntax Highlighting */}
              <div className="relative border border-white/5 rounded-xl overflow-hidden bg-[#050505] font-mono text-xs flex">
                <div className="select-none bg-[#080809]/60 border-r border-white/5 text-white/20 px-2.5 py-4 text-right leading-relaxed flex flex-col text-[11px] min-w-[32px]">
                  {Array.from({ length: Math.max(1, code.split("\n").length) }).map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                
                <div className="relative flex-1 h-[360px] lg:h-[480px] overflow-hidden">
                  {/* Highlighter Backdrop */}
                  {syntaxHighlightEnabled && (
                    <pre
                      ref={editorPreRef}
                      className="absolute inset-0 p-4 margin-0 bg-transparent text-white/80 font-mono text-xs leading-relaxed whitespace-pre overflow-hidden pointer-events-none select-none scrollbar-none"
                      style={{
                        wordWrap: "normal",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(code, isDiff) + (code.endsWith("\n") ? "\n " : "")
                      }}
                    />
                  )}

                  {/* Editable Textarea (overlay) */}
                  <textarea
                    id="code-editor-area"
                    ref={editorTextareaRef}
                    value={code}
                    onScroll={handleEditorScroll}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (loadedSessionId) {
                        setLoadedSessionId(null);
                      }
                    }}
                    placeholder="// Paste your Java source code or unified Git Diff format here..."
                    className={`absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs leading-relaxed whitespace-pre overflow-y-auto overflow-x-auto outline-none resize-none focus:ring-0 focus:border-transparent scroll-hide ${
                      syntaxHighlightEnabled ? "text-transparent caret-white" : "text-white/80"
                    }`}
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                    }}
                    spellCheck="false"
                  />
                </div>
              </div>

              {/* Controls Grid */}
              <div className="bg-[#050505]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-3.5">
                {/* Input Format Selector */}
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-white/40 font-mono uppercase tracking-wider text-[10px]">Format:</span>
                  <div className="flex gap-1.5 bg-[#0c0c0d] p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => setIsDiff(false)}
                      className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition ${
                        !isDiff 
                          ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400" 
                          : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      Raw Source
                    </button>
                    <button
                      onClick={() => setIsDiff(true)}
                      className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition ${
                        isDiff 
                          ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400" 
                          : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      Git Diff
                    </button>
                  </div>
                </div>

                {/* Audit Categories */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Audit Coverage:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["SECURITY", "PERFORMANCE", "QUALITY"].map((cat) => {
                      const active = categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => handleToggleCategorySelection(cat)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] uppercase tracking-wider font-bold border transition ${
                            active 
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" 
                              : "bg-[#0c0c0d] border-white/5 text-white/30 hover:border-white/10"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Strictness Controls */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Auditor Persona Mode:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "casual", label: "Peer Lead", desc: "Friendly peer tech lead suggestions" },
                      { id: "standard", label: "Tech Lead", desc: "Standard production grade tech lead review" },
                      { id: "paranoid", label: "Architect", desc: "Ultra-paranoid principal auditor review" }
                    ].map((mode) => {
                      const active = strictness === mode.id;
                      return (
                        <button
                          key={mode.id}
                          title={mode.desc}
                          onClick={() => setStrictness(mode.id as any)}
                          className={`py-1.5 px-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold border transition text-center ${
                            active 
                              ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400" 
                              : "bg-[#0c0c0d] border-white/5 text-white/30 hover:border-white/10"
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audit Run Button */}
                <button
                  onClick={runAudit}
                  disabled={loading}
                  className="w-full mt-1.5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-[0.15em] transition shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                  id="run-audit-btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Auditing Code...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Initiate DevGuard Audit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT SIDE: Interactive Dashboard & Reports (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-6" id="dashboard-section">
            
            {/* If there is error */}
            {error && (
              <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-200 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-semibold text-red-300">Analysis Halted</span>
                  <span className="text-xs text-slate-300 font-mono leading-relaxed">{error}</span>
                </div>
              </div>
            )}

            {/* If Loading */}
            {loading && (
              <div className="min-h-[500px] flex flex-col items-center justify-center bg-[#0c0c0d] border border-white/5 rounded-2xl p-8 text-center gap-6">
                <div className="relative">
                  {/* Glowing audit ring */}
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <ShieldAlert className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="flex flex-col gap-2 max-w-sm">
                  <h3 className="font-sans font-medium text-slate-200 text-sm uppercase tracking-widest">
                    DevGuard Static Analyzer Active
                  </h3>
                  <p className="text-xs text-white/40 font-mono h-10 flex items-center justify-center">
                    {loadingStep}
                  </p>
                </div>
                {/* Simulated log printouts */}
                <div className="w-full max-w-md bg-[#050505] p-4 border border-white/5 rounded-xl text-left font-mono text-[10px] text-indigo-400/80 leading-relaxed overflow-hidden h-28">
                  <div className="animate-pulse">{"[SYSTEM] Booting Security Context Analyser..."}</div>
                  <div>{"[ANALYSIS] scanning: API Keys, AWS Access, SQL Statement structures..."}</div>
                  <div>{"[AST] mapped: classes, controllers, database mappings..."}</div>
                  <div>{"[COMPILING] pipeline validation for Java 17/21 rules..."}</div>
                </div>
              </div>
            )}

            {/* If Welcome / Empty State */}
            {!loading && !report && !error && (
              <div className="min-h-[500px] flex flex-col items-center justify-center bg-[#0c0c0d] border border-white/5 rounded-3xl p-8 text-center">
                <div className="p-4 bg-[#050505] border border-white/5 rounded-2xl mb-5 text-[#e5e5e5]/80">
                  <ShieldAlert className="w-12 h-12 text-indigo-500 animate-bounce" />
                </div>
                <h3 className="serif italic text-xl text-white/95 mb-2 font-medium">
                  No Active Review Logged
                </h3>
                <p className="text-xs text-white/40 max-w-md leading-relaxed mb-6 font-mono">
                  Select a test case from the top dropdown, or paste your raw Java controller, service files, or a unified git diff in the editor. Then click <strong className="text-indigo-400">Initiate DevGuard Audit</strong> to parse issues.
                </p>

                {/* Informational Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-xl text-left">
                  <div className="p-4 bg-[#050505] border border-white/5 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs uppercase tracking-widest font-mono">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Security</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed font-mono">
                      Detects SQL injection, leaked credential objects, and authorization flaws.
                    </p>
                  </div>
                  <div className="p-4 bg-[#050505] border border-white/5 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs uppercase tracking-widest font-mono">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Performance</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed font-mono">
                      Flags Hibernate N+1 loops, memory-unsafe collections, and unclosed connection streams.
                    </p>
                  </div>
                  <div className="p-4 bg-[#050505] border border-white/5 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-xs uppercase tracking-widest font-mono">
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Clean Code</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed font-mono">
                      Validates NullPointer risks, exception handling omissions, and standard naming conventions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* If Report Received */}
            {report && !loading && (
              <div className="flex flex-col gap-6" id="audit-results-panel">
                
                {/* Bento Grid Executive Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4" id="scores-bento-grid">
                  
                  {/* Security Score */}
                  <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Security</span>
                    <div className="relative flex items-center justify-center w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className="text-white/5" fill="transparent" />
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className={report.securityScore >= 80 ? "text-emerald-500" : report.securityScore >= 50 ? "text-amber-500" : "text-rose-500"} fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={calculateDashOffset(report.securityScore)} />
                      </svg>
                      <span className={`absolute font-mono font-bold text-base ${getScoreColor(report.securityScore)}`}>
                        {report.securityScore}
                      </span>
                    </div>
                  </div>

                  {/* Performance Score */}
                  <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Performance</span>
                    <div className="relative flex items-center justify-center w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className="text-white/5" fill="transparent" />
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className={report.performanceScore >= 80 ? "text-emerald-500" : report.performanceScore >= 50 ? "text-amber-500" : "text-rose-500"} fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={calculateDashOffset(report.performanceScore)} />
                      </svg>
                      <span className={`absolute font-mono font-bold text-base ${getScoreColor(report.performanceScore)}`}>
                        {report.performanceScore}
                      </span>
                    </div>
                  </div>

                  {/* Quality Score */}
                  <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Code Quality</span>
                    <div className="relative flex items-center justify-center w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className="text-white/5" fill="transparent" />
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className={report.qualityScore >= 80 ? "text-emerald-500" : report.qualityScore >= 50 ? "text-amber-500" : "text-rose-500"} fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={calculateDashOffset(report.qualityScore)} />
                      </svg>
                      <span className={`absolute font-mono font-bold text-base ${getScoreColor(report.qualityScore)}`}>
                        {report.qualityScore}
                      </span>
                    </div>
                  </div>

                  {/* Threat Meter & Issues count */}
                  <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-left gap-2 sm:col-span-1">
                    <div>
                      <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Threat Level</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          report.threatLevel === "CRITICAL" ? "bg-red-500" : 
                          report.threatLevel === "HIGH" ? "bg-orange-500" : 
                          report.threatLevel === "MEDIUM" ? "bg-yellow-500" : "bg-blue-500"
                        } animate-pulse`} />
                        <span className={`font-mono font-bold text-xs tracking-widest uppercase ${
                          report.threatLevel === "CRITICAL" ? "text-red-400" : 
                          report.threatLevel === "HIGH" ? "text-orange-400" : 
                          report.threatLevel === "MEDIUM" ? "text-yellow-300" : "text-blue-400"
                        }`}>
                          {report.threatLevel}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs">
                      <span className="text-white/40 font-mono">Total Issues:</span>
                      <span className="font-bold text-white font-mono">{report.issues.length}</span>
                    </div>
                  </div>

                </div>

                {/* Executive Audit Narrative */}
                <div className="p-5 bg-[#0c0c0d] border border-white/5 rounded-2xl flex items-start gap-4 shadow-xl">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 mt-1 shrink-0">
                    <BookOpen className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <h4 className="font-mono font-medium text-xs uppercase tracking-widest text-white/40">
                      DevGuard Executive Briefing
                    </h4>
                    <p className="text-xs text-white/80 leading-relaxed font-sans italic">
                      "{report.executiveSummary}"
                    </p>
                  </div>
                </div>

                {/* Findings Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2 self-start">
                    <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Findings:</span>
                    <span className="text-xs px-2 py-0.5 bg-[#0c0c0d] border border-white/5 rounded-full font-bold text-white/60 font-mono">
                      {filteredIssues.length} of {report.issues.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Category Filter */}
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="bg-[#0c0c0d] border border-white/5 hover:border-white/10 text-[11px] rounded-lg px-2.5 py-1 text-white/80 outline-none font-mono"
                    >
                      <option value="ALL">All Categories</option>
                      <option value="SECURITY">🛡️ Security</option>
                      <option value="PERFORMANCE">⚡ Performance</option>
                      <option value="QUALITY">📦 Quality</option>
                    </select>

                    {/* Severity Filter */}
                    <select
                      value={selectedSeverityFilter}
                      onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                      className="bg-[#0c0c0d] border border-white/5 hover:border-white/10 text-[11px] rounded-lg px-2.5 py-1 text-white/80 outline-none font-mono"
                    >
                      <option value="ALL">All Severities</option>
                      <option value="CRITICAL">🚨 Critical</option>
                      <option value="HIGH">🔥 High</option>
                      <option value="MEDIUM">⚠️ Medium</option>
                      <option value="LOW">🔵 Low</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Search findings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-[#0c0c0d] border border-white/5 hover:border-white/10 text-[11px] rounded-lg px-2.5 py-1 text-white/80 outline-none w-full sm:w-36 focus:w-44 focus:border-indigo-500/50 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Audit Feed Items */}
                <div className="flex flex-col gap-4" id="issues-feed">
                  {filteredIssues.length === 0 ? (
                    <div className="py-12 border border-dashed border-white/5 rounded-2xl text-center text-white/30 text-xs font-mono">
                      No matching audit findings. Try widening your filters.
                    </div>
                  ) : (
                    filteredIssues.map((issue, idx) => {
                      const isExpanded = !!expandedIssues[idx];
                      const styles = getSeverityStyle(issue.severity);

                      return (
                        <div 
                          key={idx}
                          className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                            isExpanded ? "border-white/10 bg-[#0c0c0d]/70" : "border-white/5 hover:border-white/10 bg-[#0c0c0d]/20"
                          }`}
                          id={`issue-card-${idx}`}
                        >
                          {/* Issue header block */}
                          <div 
                            onClick={() => setExpandedIssues(prev => ({ ...prev, [idx]: !isExpanded }))}
                            className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider ${styles.badge}`}>
                                {issue.severity}
                              </span>
                              <div>
                                <h4 className="font-sans font-semibold text-sm text-white/90">
                                  {issue.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 font-mono text-[9px] uppercase tracking-wider text-white/40">
                                  <span className="font-bold">{issue.category}</span>
                                  <span>•</span>
                                  <span className="max-w-[200px] truncate">{issue.filePath}</span>
                                  <span>•</span>
                                  <span>Line {issue.lineStart}</span>
                                </div>
                              </div>
                            </div>

                            <button className="text-white/40 hover:text-white p-1 rounded">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Expanded detail section */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-white/5"
                              >
                                <div className="p-5 flex flex-col gap-4 text-xs">
                                  
                                  {/* Explanation / Vulnerability logic */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="p-4 bg-[#050505] border border-white/5 rounded-xl flex flex-col gap-2">
                                      <div className="flex items-center gap-1.5 text-rose-400 font-semibold uppercase tracking-wider font-mono text-[10px]">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Issue Risk & Impact</span>
                                      </div>
                                      <p className="text-white/80 leading-relaxed font-sans whitespace-pre-line">
                                        {issue.explanation}
                                      </p>
                                    </div>

                                    <div className="p-4 bg-[#050505] border border-white/5 rounded-xl flex flex-col gap-2">
                                      <div className="flex items-center gap-1.5 text-indigo-400 font-semibold uppercase tracking-wider font-mono text-[10px]">
                                        <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Remediation Design</span>
                                      </div>
                                      <p className="text-white/80 leading-relaxed font-sans whitespace-pre-line">
                                        {issue.remediation}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Interactive Remediation Code Playground */}
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/40">
                                        <span>Remediation Playground</span>
                                        <button 
                                          onClick={() => applyRemediation(issue, idx)}
                                          className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-bold tracking-wider uppercase text-[10px] transition-all flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                          <span>Auto-Apply Fix To Editor</span>
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px] leading-relaxed">
                                        {/* Before Code (Flagged Block) */}
                                        <div className="border border-red-950/20 rounded-xl bg-red-950/5 overflow-hidden flex flex-col">
                                          <div className="bg-red-950/10 border-b border-red-950/15 px-3 py-1.5 text-red-400 font-bold text-[9px] uppercase tracking-widest">
                                            Offending Block (Before)
                                          </div>
                                          <pre className="p-3 overflow-x-auto text-red-300/80 max-h-[180px] whitespace-pre-wrap select-all">
                                            {issue.beforeCode}
                                          </pre>
                                        </div>

                                        {/* After Code (Corrected Block) */}
                                        <div className="border border-emerald-950/20 rounded-xl bg-emerald-950/5 overflow-hidden flex flex-col">
                                          <div className="bg-emerald-950/10 border-b border-emerald-950/15 px-3 py-1.5 text-emerald-400 font-bold text-[9px] uppercase tracking-widest">
                                            Remediated Block (After)
                                          </div>
                                          <pre className="p-3 overflow-x-auto text-emerald-300 max-h-[180px] whitespace-pre-wrap select-all">
                                            {issue.afterCode}
                                          </pre>
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

          </section>

        </div>
      </main>

      {/* FLOATING CONSULTATION CHAT (Bottom-Right or Expanded Panel) */}
      <div className="fixed bottom-6 right-6 z-40" id="devguard-chat-wrapper">
        <AnimatePresence>
          {chatOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="w-full sm:w-[400px] h-[500px] bg-[#0c0c0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              id="chat-console-panel"
            >
              {/* Chat Title bar */}
              <div className="bg-[#050505] border-b border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <div>
                    <h3 className="font-mono font-medium uppercase tracking-widest text-xs text-white/90">
                      DevGuard AI Consultation
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono">
                      Ask about fixes, concurrency, JVM, etc.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setChatOpen(false)}
                  className="text-white/60 hover:text-white text-[10px] uppercase font-mono tracking-wider px-2.5 py-1 bg-white/5 rounded-lg border border-white/10"
                >
                  Close
                </button>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 font-sans text-xs scroll-hide">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/30 text-center px-6 font-mono text-[11px] leading-relaxed">
                    Audit some code to unlock interactive DevGuard AI follow-up conversations.
                  </div>
                ) : (
                  chatMessages.map((m) => (
                    <div 
                      key={m.id}
                      className={`flex flex-col max-w-[85%] ${
                        m.role === "user" ? "self-end items-end" : "self-start items-start"
                      }`}
                    >
                      <span className="text-[9px] font-mono text-white/30 mb-0.5">{m.timestamp}</span>
                      <div className={`p-3 rounded-xl leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" 
                          ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 rounded-tr-none" 
                          : "bg-[#050505] border border-white/5 text-white/80 rounded-tl-none"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="self-start flex flex-col items-start gap-1">
                    <span className="text-[9px] font-mono text-white/30">DevGuard AI is typing...</span>
                    <div className="p-3 bg-[#050505] border border-white/5 text-white/40 rounded-xl rounded-tl-none flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-[#050505] border-t border-white/5 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a technical follow-up question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  className="w-full bg-[#0c0c0d] border border-white/5 rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-indigo-500/50 font-sans"
                />
                <button 
                  onClick={sendChatMessage}
                  className="p-2 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </motion.div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setChatOpen(true)}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full shadow-2xl flex items-center gap-2 text-xs uppercase tracking-[0.15em]"
              id="toggle-chat-btn"
            >
              <MessageSquare className="w-4.5 h-4.5" />
              <span>DevGuard Consult</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar / Drawer for Recent Audits */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            {/* Sidebar panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[450px] bg-[#0c0c0d] border-l border-white/10 z-50 flex flex-col shadow-2xl overflow-hidden"
              id="recent-audits-sidebar"
            >
              {/* Header */}
              <div className="bg-[#050505] border-b border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <div>
                    <h3 className="font-mono font-medium uppercase tracking-widest text-xs text-white/90">
                      Recent Audit Cache
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono">
                      Last 5 sessions stored locally
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="text-white/60 hover:text-white text-[10px] uppercase font-mono tracking-wider px-2.5 py-1 bg-white/5 rounded-lg border border-white/10"
                >
                  Close
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scroll-hide">
                {recentAudits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <History className="w-5 h-5 text-white/20" />
                    </div>
                    <p className="text-xs text-white/30 font-mono leading-relaxed max-w-xs">
                      No historical audit sessions cached. Run code audits to automatically save reports and chats.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {recentAudits.map((session) => {
                      const isLoaded = loadedSessionId === session.id;
                      const hasCritical = session.report.issues.some(i => i.severity === "CRITICAL");
                      const hasHigh = session.report.issues.some(i => i.severity === "HIGH");
                      
                      let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                      let badgeLabel = "CLEAN";
                      if (hasCritical) {
                        badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
                        badgeLabel = "CRITICAL";
                      } else if (hasHigh) {
                        badgeColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                        badgeLabel = "HIGH RISK";
                      } else if (session.report.issues.length > 0) {
                        badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        badgeLabel = "ISSUES";
                      }

                      return (
                        <div
                          key={session.id}
                          onClick={() => loadAuditSession(session)}
                          className={`p-3.5 rounded-xl border transition text-left cursor-pointer flex flex-col gap-2.5 ${
                            isLoaded
                              ? "bg-indigo-500/5 border-indigo-500/40 shadow-lg shadow-indigo-500/5 hover:bg-indigo-500/10"
                              : "bg-[#050505] border-white/5 hover:border-white/15 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-sans font-semibold text-xs text-white/95 truncate">
                                {session.title}
                              </h4>
                              <p className="text-[10px] text-white/40 font-mono mt-0.5">
                                {session.timestamp}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                              <button
                                onClick={(e) => deleteAuditSession(session.id, e)}
                                title="Delete Session"
                                className="p-1 hover:bg-white/5 text-white/30 hover:text-red-400 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Mini metrics bar */}
                          <div className="grid grid-cols-3 gap-1.5 bg-[#0c0c0d]/80 rounded-lg p-2 border border-white/5 font-mono text-[10px]">
                            <div className="flex flex-col items-center">
                              <span className="text-white/30 text-[9px] uppercase tracking-wider">Sec</span>
                              <span className={`font-semibold ${getScoreColor(session.report.securityScore)}`}>
                                {session.report.securityScore}
                              </span>
                            </div>
                            <div className="flex flex-col items-center border-x border-white/5">
                              <span className="text-white/30 text-[9px] uppercase tracking-wider">Perf</span>
                              <span className={`font-semibold ${getScoreColor(session.report.performanceScore)}`}>
                                {session.report.performanceScore}
                              </span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-white/30 text-[9px] uppercase tracking-wider">Qual</span>
                              <span className={`font-semibold ${getScoreColor(session.report.qualityScore)}`}>
                                {session.report.qualityScore}
                              </span>
                            </div>
                          </div>

                          {/* Chat history summary */}
                          {session.chatMessages.length > 1 && (
                            <div className="flex items-center gap-1 text-[9px] text-indigo-400/80 font-mono bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/15 self-start">
                              <MessageSquare className="w-3 h-3" />
                              <span>{session.chatMessages.length - 1} follow-up Q&A messages saved</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Clear all footer */}
              {recentAudits.length > 0 && (
                <div className="p-4 bg-[#050505] border-t border-white/5">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to clear your entire audit history cache?")) {
                        try {
                          localStorage.removeItem("devguard_recent_audits");
                          setRecentAudits([]);
                          setLoadedSessionId(null);
                          showToast("Audit history cache cleared.", "info");
                        } catch (err) {
                          console.warn("Failed to clear local audits:", err);
                        }
                      }
                    }}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-[10px] uppercase tracking-widest rounded-xl transition"
                  >
                    Clear History Cache
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
