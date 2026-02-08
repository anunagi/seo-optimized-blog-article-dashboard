"use client";

import { useState, useRef, useEffect } from "react";
import { Send, CheckCircle, Loader2, FileText, Globe, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type StepStatus = "idle" | "running" | "completed" | "error";

interface WorkflowStep {
  id: number;
  label: string;
  status: StepStatus;
  detail?: string;
}

const STEPS: WorkflowStep[] = [
  { id: 1, label: "Keyword Processing", status: "idle" },
  { id: 2, label: "Competitor Research", status: "idle" }, // Firecrawl Search
  { id: 3, label: "URL Extraction", status: "idle" },
  { id: 4, label: "Scraping Pages", status: "idle" }, // Loop (4-7)
  { id: 5, label: "Content Analysis", status: "idle" }, // Combine & Prep
  { id: 6, label: "Data Extractor & Summarizer", status: "idle" }, // LLM Summary
  { id: 7, label: "SEO Content", status: "idle" }, // LLM Write
  { id: 8, label: "Refine Content", status: "idle" }, // LLM Refine
  { id: 9, label: "Final Delivery", status: "idle" }, // Save Drive
];

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>(STEPS);
  const [resultData, setResultData] = useState<{ link?: string; content?: string; filename?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startWorkflow = async () => {
    if (!keyword.trim()) return;

    setIsProcessing(true);
    setResultData(null);
    setErrorMsg(null);
    setSteps(prev => prev.map(s => ({ ...s, status: "idle", detail: "" })));

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      if (!response.ok) {
        throw new Error("Failed to start workflow");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              handleUpdate(data);
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }

    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setIsProcessing(false);
    }
  };

  const handleUpdate = (data: { step: number; message: string; data?: any }) => {
    const { step, message, data: payload } = data;

    setSteps(prev => {
      const newSteps = [...prev];

      // Map backend step numbers to frontend IDs
      let targetId = step;
      if (step >= 4 && step <= 7) targetId = 4; // Scraping pages
      else if (step === 8) targetId = 5; // Content Analysis
      else if (step === 9) targetId = 6; // Strategy & Summary
      else if (step === 10) targetId = 7; // Drafting Article
      else if (step === 11) targetId = 8; // Refining & Humanizing
      else if (step === 12) targetId = 9; // Final Delivery

      newSteps.forEach(s => {
        if (s.id < targetId && s.status !== "completed") {
          s.status = "completed";
        }
      });

      const currentParams = newSteps.find(s => s.id === targetId);
      if (currentParams) {
        currentParams.status = "running";
        currentParams.detail = message;
      }

      if (step === 12 && message === "Process completed!") {
        const finalStep = newSteps.find(s => s.id === 9);
        if (finalStep) finalStep.status = "completed";

        setResultData({
          link: payload?.resultLink,
          content: payload?.content,
          filename: payload?.filename
        });
        setIsProcessing(false);
      }

      if (step === 0) {
        setIsProcessing(false);
        setErrorMsg(message);
      }

      return newSteps;
    });
  };

  const downloadFile = () => {
    if (!resultData?.content) return;
    const blob = new Blob([resultData.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultData.filename || "article.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-3 rounded-2xl bg-indigo-500/20 mb-4 backdrop-blur-sm"
          >
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </motion.div>
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-400 mb-4">
            SEO Article Generator
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Generate competitor-crushing content in seconds. Powered by Firecrawl & AI.
          </p>
        </header>

        {/* Input Section */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8 backdrop-blur-md shadow-xl">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter target keyword (e.g. 'best crm software 2025')"
              className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-6 py-4 text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={isProcessing}
            />
            <button
              onClick={startWorkflow}
              disabled={isProcessing || !keyword}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send />}
              Generate
            </button>
          </div>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {steps.map((step) => (
              <StepItem key={step.id} step={step} />
            ))}
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-fit min-h-[400px] flex flex-col items-center justify-center text-center">
            {!resultData && !errorMsg && !isProcessing && (
              <div className="text-slate-500">
                <Globe className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Results will appear here</p>
              </div>
            )}

            {isProcessing && !resultData && (
              <div className="text-indigo-400">
                <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin opacity-50" />
                <p className="animate-pulse">Analyzing search landscape...</p>
              </div>
            )}

            {resultData && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Generation Complete!</h3>
                <p className="text-slate-400 mb-8">Your content is ready.</p>

                <div className="space-y-3">
                  {resultData.link && resultData.link.startsWith("http") && (
                    <a
                      href={resultData.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <Globe className="w-5 h-5" />
                      Open in Google Drive
                    </a>
                  )}

                  {resultData.content && (
                    <button
                      onClick={downloadFile}
                      className="block w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700"
                    >
                      <FileText className="w-5 h-5" />
                      Download Markdown
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {errorMsg && (
              <div className="text-rose-400">
                <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">!</span>
                </div>
                <p>{errorMsg}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StepItem({ step }: { step: WorkflowStep }) {
  const isActive = step.status === "running";
  const isDone = step.status === "completed";

  return (
    <motion.div
      initial={false}
      animate={{
        backgroundColor: isActive ? "rgba(99, 102, 241, 0.1)" : "rgba(30, 41, 59, 0.3)",
        borderColor: isActive ? "rgba(99, 102, 241, 0.5)" : "transparent"
      }}
      className={cn(
        "p-4 rounded-xl border border-transparent transition-all",
        isDone && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
          isActive ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/50" :
            isDone ? "bg-green-500/20 text-green-400" : "bg-slate-800 text-slate-500"
        )}>
          {isDone ? <CheckCircle className="w-5 h-5" /> : step.id}
        </div>
        <div className="flex-1">
          <h3 className={cn("font-medium", isActive ? "text-white" : "text-slate-400")}>
            {step.label}
          </h3>
          <AnimatePresence>
            {isActive && step.detail && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-sm text-indigo-300 mt-1"
              >
                {step.detail}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {isActive && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
      </div>
    </motion.div>
  );
}
