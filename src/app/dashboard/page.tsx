"use client";

import {
  AlertTriangle,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import type { ActivityEvent } from "@/components/dashboard/activity-timeline";
import type { RecentProject } from "@/components/dashboard/project-card";
import type { RecentBoq } from "@/components/dashboard/boq-summary-card";
import type { RecentFile } from "@/components/dashboard/file-status-card";
import type { RecentDocument } from "@/components/dashboard/document-card";

type SessionData = {
  authenticated: boolean;
  user?: { fullName: string; email: string; role: string };
};

type DashboardMetrics = {
  activeProjects: number;
  totalClients: number;
  totalBoqs: number;
  totalUploadedFiles: number;
  totalGeneratedDocuments: number;
  catalogueItems: number;
  pendingApprovals: number;
  failedOperations: number;
};

type RecentClient = {
  id: string;
  name: string;
  contactName: string;
  email: string | null;
  createdAt: string;
  projectCount: number;
  lastActivityAt: string | null;
};

type SubscriptionSummary = {
  companyName: string | null;
  planName: string | null;
  planType: string | null;
  status: string;
  trialExpiresAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

export default function DashboardPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [projects, setProjects] = useState<RecentProject[] | null>(null);
  const [boqs, setBoqs] = useState<RecentBoq[] | null>(null);
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const [documents, setDocuments] = useState<RecentDocument[] | null>(null);
  const [clients, setClients] = useState<RecentClient[] | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionData, metricsData, subscriptionData] = await Promise.all([
        apiClient.get<SessionData>("/api/auth/session", signal),
        apiClient.get<DashboardMetrics>("/api/dashboard/metrics", signal),
        apiClient.get<SubscriptionSummary>("/api/dashboard/subscription-summary", signal),
      ]);

      if (!sessionData.authenticated) {
        throw new Error("Your session could not be verified.");
      }

      setSession(sessionData);
      setMetrics(metricsData);
      setSubscription(subscriptionData);

      const [projectsResult, boqsResult, filesResult, documentsResult, clientsResult, activityResult] =
        await Promise.allSettled([
          apiClient.get<RecentProject[]>("/api/dashboard/recent-projects", signal),
          apiClient.get<RecentBoq[]>("/api/dashboard/recent-boqs", signal),
          apiClient.get<RecentFile[]>("/api/dashboard/recent-files", signal),
          apiClient.get<RecentDocument[]>("/api/dashboard/recent-documents", signal),
          apiClient.get<RecentClient[]>("/api/dashboard/recent-clients", signal),
          apiClient.get<ActivityEvent[]>("/api/dashboard/activity", signal),
        ]);

      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value);
      if (boqsResult.status === "fulfilled") setBoqs(boqsResult.value);
      if (filesResult.status === "fulfilled") setFiles(filesResult.value);
      if (documentsResult.status === "fulfilled") setDocuments(documentsResult.value);
      if (clientsResult.status === "fulfilled") setClients(clientsResult.value);
      if (activityResult.status === "fulfilled") setActivity(activityResult.value);

    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin mx-auto"></div>
          <p className="terminal-text text-sm uppercase tracking-[0.4em] text-[#00F0FF] animate-pulse">Initializing HUD...</p>
        </div>
      </div>
    );
  }

  if (loadError || !metrics || !session?.user) {
    return (
      <div className="cyber-panel cyber-border p-8">
        <p className="terminal-text text-sm font-bold text-[#FF0055] uppercase tracking-widest">System Failure</p>
        <p className="mt-2 text-xs terminal-text text-slate-400">{loadError ?? "Neural grid linkage could not be established."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 border border-[#FF0055]/50 bg-[#FF0055]/10 px-4 py-2 text-[10px] font-bold text-[#FF0055] hover:bg-[#FF0055]/20 terminal-text uppercase tracking-widest transition-colors"
        >
          Re-Initialize
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#030508] text-[#00F0FF] font-mono flex flex-col relative w-full h-full pb-8">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00F0FF]/5 via-transparent to-transparent pointer-events-none z-0"></div>

      {/* Main HUD Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr_1fr] gap-6 relative z-10 flex-1">
        
        {/* Left Column: AI Core & Overview */}
        <div className="space-y-6 flex flex-col h-full">
          {/* AI CORE PANEL */}
          <div className="cyber-border cyber-panel p-5 flex flex-col relative overflow-hidden group h-[280px]">
            <h2 className="text-[#00F0FF] text-[10px] uppercase tracking-[0.4em] mb-4 border-b border-[#00F0FF]/30 pb-2">AI Core: Active</h2>
            <div className="flex-1 relative flex items-center justify-center bg-black/40 border border-white/5 cyber-border">
               {/* Abstract Neural Net Visualization */}
               <svg viewBox="0 0 100 100" className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity absolute inset-0">
                 {/* Connecting lines */}
                 <path d="M20,50 L50,20 L80,50 L50,80 Z" fill="none" stroke="rgba(0,240,255,0.3)" strokeWidth="0.5" />
                 <path d="M30,30 L70,70" fill="none" stroke="rgba(255,0,85,0.3)" strokeWidth="0.5" />
                 <path d="M30,70 L70,30" fill="none" stroke="rgba(255,0,85,0.3)" strokeWidth="0.5" />
                 <path d="M50,10 L50,90" fill="none" stroke="rgba(0,240,255,0.3)" strokeWidth="0.5" />
                 {/* Nodes */}
                 <circle cx="50" cy="50" r="4" fill="#FF0055" className="animate-pulse" />
                 <circle cx="20" cy="50" r="2" fill="#00F0FF" />
                 <circle cx="80" cy="50" r="2" fill="#00F0FF" />
                 <circle cx="50" cy="20" r="3" fill="#00F0FF" />
                 <circle cx="50" cy="80" r="3" fill="#00F0FF" />
                 <circle cx="30" cy="30" r="2" fill="#00F0FF" />
                 <circle cx="70" cy="70" r="2" fill="#00F0FF" />
                 <circle cx="30" cy="70" r="2" fill="#00F0FF" />
                 <circle cx="70" cy="30" r="2" fill="#00F0FF" />
               </svg>
            </div>
          </div>
          
          {/* CORE OVERVIEW NAVIGATION */}
          <div className="cyber-border cyber-panel p-5">
            <h2 className="text-white text-lg uppercase tracking-widest font-bold mb-4">Core Overview</h2>
            <nav className="space-y-1">
              <Link href="#" className="block px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] uppercase tracking-widest text-[10px] border-l-2 border-[#00F0FF]">Overview</Link>
              <Link href="#" className="block px-4 py-2 hover:bg-[#00F0FF]/10 text-slate-400 hover:text-[#00F0FF] uppercase tracking-widest text-[10px] transition-colors">Neural Nets</Link>
              <Link href="#" className="block px-4 py-2 hover:bg-[#00F0FF]/10 text-slate-400 hover:text-[#00F0FF] uppercase tracking-widest text-[10px] transition-colors">Analytics</Link>
              <Link href="#" className="block px-4 py-2 hover:bg-[#00F0FF]/10 text-slate-400 hover:text-[#00F0FF] uppercase tracking-widest text-[10px] transition-colors">Settings</Link>
            </nav>
          </div>

          {/* NETWORK HEALTH & DATA STREAMS */}
          <div className="cyber-border cyber-panel p-5 space-y-5">
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-widest mb-2 font-bold">
                <span className="text-white">Network Health</span>
                <span className="text-[#00F0FF]">98.7%</span>
              </div>
              <div className="h-1 bg-[#00F0FF]/20 w-full overflow-hidden shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                <div className="h-full bg-[#00F0FF] w-[98.7%]"></div>
              </div>
            </div>
            <div>
               <h3 className="text-[10px] uppercase tracking-widest text-white font-bold mb-3">Data Streams</h3>
               <div className="flex gap-3">
                 <div className="flex-1 h-16 border border-[#FF0055]/30 flex flex-col justify-between p-1 bg-black/40 cyber-border">
                   <span className="text-[7px] text-[#FF0055] uppercase">Graph</span>
                   <svg viewBox="0 0 100 30" className="w-full h-8">
                     <path d="M0,25 Q10,5 20,20 T40,15 T60,25 T80,10 T100,20" fill="none" stroke="#FF0055" strokeWidth="1.5" />
                     <path d="M0,25 Q10,5 20,20 T40,15 T60,25 T80,10 T100,20 L100,30 L0,30 Z" fill="rgba(255,0,85,0.1)" />
                   </svg>
                 </div>
                 <div className="flex-1 h-16 border border-[#00F0FF]/30 flex flex-col justify-between p-1 bg-black/40 cyber-border">
                   <span className="text-[7px] text-[#00F0FF] uppercase">Network Act</span>
                   <svg viewBox="0 0 100 30" className="w-full h-8">
                     <path d="M0,20 Q15,30 30,10 T60,15 T80,5 T100,20" fill="none" stroke="#00F0FF" strokeWidth="1.5" />
                     <path d="M0,20 Q15,30 30,10 T60,15 T80,5 T100,20 L100,30 L0,30 Z" fill="rgba(0,240,255,0.1)" />
                   </svg>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Center Column: The Upload Ring */}
        <div className="flex flex-col items-center justify-center relative py-12 xl:py-0">
          <div className="absolute top-0 text-center w-full z-20">
             <div className="inline-flex items-center gap-4 cyber-border border border-[#00F0FF]/30 bg-[#00F0FF]/5 px-8 py-2">
                <span className="w-2 h-2 bg-[#00F0FF] animate-pulse"></span>
                <h1 className="text-sm text-white tracking-[0.4em] font-bold uppercase">Premium Futurice Dashboard</h1>
                <span className="w-2 h-2 bg-[#00F0FF] animate-pulse"></span>
             </div>
          </div>
          
          {/* Giant glowing ring */}
          <Link href="/imports" className="relative group w-72 h-72 sm:w-80 sm:h-80 xl:w-[400px] xl:h-[400px] flex items-center justify-center cursor-pointer mt-12 xl:mt-0">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 rounded-full border-[6px] border-[#00F0FF]/10 border-t-[#00F0FF] border-b-[#00F0FF] animate-[spin_8s_linear_infinite] group-hover:border-t-[#FF0055] group-hover:border-b-[#FF0055] transition-colors shadow-[0_0_40px_rgba(0,240,255,0.2)] group-hover:shadow-[0_0_60px_rgba(255,0,85,0.4)] z-10"></div>
            
            {/* Inner dashed ring */}
            <div className="absolute inset-6 rounded-full border-[3px] border-dashed border-[#00F0FF]/30 animate-[spin_15s_linear_infinite_reverse] group-hover:border-[#FF0055]/30 z-10"></div>
            
            {/* Static background glow */}
            <div className="absolute inset-10 rounded-full bg-gradient-to-b from-[#00F0FF]/10 to-transparent blur-xl group-hover:from-[#FF0055]/10 z-0 transition-colors"></div>
            
            <div className="text-center z-20 relative flex flex-col items-center justify-center bg-black/60 w-56 h-56 rounded-full border border-white/5 cyber-border backdrop-blur-sm">
               <Upload className="w-12 h-12 text-[#00F0FF] mb-3 group-hover:text-[#FF0055] transition-colors group-hover:-translate-y-1 duration-300" />
               <p className="text-white text-base font-bold uppercase tracking-widest group-hover:text-[#FF0055] transition-colors">Drag & Drop Files</p>
               <p className="text-[#00F0FF] text-[10px] uppercase tracking-[0.2em] group-hover:text-white transition-colors mt-1">Click to Upload</p>
            </div>
          </Link>
          
          {/* Upload Progress Bar Placeholder */}
          <div className="absolute bottom-4 xl:bottom-12 w-64 text-center z-20">
             <p className="text-[10px] uppercase tracking-widest text-white font-bold mb-2">System Ready...</p>
             <div className="h-1 bg-[#00F0FF]/20 w-full overflow-hidden shadow-[0_0_10px_rgba(0,240,255,0.3)]">
               <div className="h-full bg-[#00F0FF] w-full relative">
                 <div className="absolute inset-0 bg-white/50 w-8 blur-[2px] animate-[pulse_2s_linear_infinite]"></div>
               </div>
             </div>
             <p className="text-[8px] uppercase tracking-widest text-slate-500 mt-2">File: Awaiting Input | Size: N/A</p>
          </div>
        </div>

        {/* Right Column: Terminal & System Status */}
        <div className="space-y-6 flex flex-col h-full">
          {/* SYSTEM STATUS (Metrics) */}
          <div className="cyber-border cyber-panel p-5">
             <h2 className="text-[#00F0FF] text-[10px] uppercase tracking-[0.4em] mb-4 border-b border-[#00F0FF]/30 pb-2">System Status</h2>
             <div className="flex gap-3">
               <div className="flex-1 text-center border border-[#FF0055]/30 p-3 bg-black/40 cyber-border">
                 <p className="text-[8px] uppercase tracking-widest text-slate-400 mb-1">CPU Load</p>
                 <p className="text-lg font-bold text-[#FF0055]">74%</p>
               </div>
               <div className="flex-1 text-center border border-[#00F0FF]/30 p-3 bg-black/40 cyber-border">
                 <p className="text-[8px] uppercase tracking-widest text-slate-400 mb-1">Mem Usage</p>
                 <p className="text-lg font-bold text-[#00F0FF]">61%</p>
               </div>
               <div className="flex-1 text-center border border-[#00F0FF]/30 p-3 bg-black/40 cyber-border">
                 <p className="text-[8px] uppercase tracking-widest text-slate-400 mb-1">Latency</p>
                 <p className="text-lg font-bold text-[#00F0FF]">20ms</p>
               </div>
             </div>
          </div>

          {/* TERMINAL LOGS (Activity) */}
          <div className="cyber-border cyber-panel p-5 flex-1 flex flex-col min-h-[250px]">
            <div className="flex justify-between items-center border-b border-[#00F0FF]/30 pb-2 mb-4">
               <h2 className="text-[#00F0FF] text-[10px] uppercase tracking-[0.4em]">Terminal Logs</h2>
               <div className="flex gap-1.5">
                 <span className="w-1.5 h-1.5 border border-[#00F0FF]"></span>
                 <span className="w-1.5 h-1.5 border border-[#00F0FF]"></span>
                 <span className="w-1.5 h-1.5 bg-[#00F0FF]"></span>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[9px] text-slate-400 terminal-text pr-2">
              {activity && activity.length > 0 ? activity.map((event, i) => (
                <div key={event.id || i} className="flex gap-3 hover:bg-[#00F0FF]/10 p-1 rounded-sm border-l border-transparent hover:border-[#00F0FF] transition-colors">
                  <span className="text-[#00F0FF] shrink-0">{formatDate(event.createdAt)}</span>
                  <span className="text-[#FF0055] shrink-0">[SYS]</span>
                  <span className="text-white truncate" title={event.action}>{event.action}</span>
                </div>
              )) : (
                <div className="space-y-1">
                  <p className="text-[#00F0FF]">Initialize log stream...</p>
                  <p className="text-white">AWAITING SYSTEM DATA...</p>
                  <p className="animate-pulse">_</p>
                </div>
              )}
            </div>
          </div>
          
          {/* NETWORK LOG */}
          <div className="cyber-border cyber-panel p-5 h-48 flex flex-col">
            <h2 className="text-[#00F0FF] text-[10px] uppercase tracking-[0.4em] mb-4 border-b border-[#00F0FF]/30 pb-2">Network Log</h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[9px] text-[#00F0FF]/70 terminal-text">
              <p>network.log: tx_0x123A connection established</p>
              <p>network.log: rx_0x442B routing incoming streams</p>
              <p>network.log: sys_0x992C <span className="text-[#FF0055]">WARNING: latency spike detected</span></p>
              <p>network.log: tx_0x123B optimizing route</p>
              <p>network.log: tx_0x123C optimal route established</p>
              <p>network.log: sys_0x992D <span className="text-white">All systems nominal</span></p>
              <p className="animate-pulse">_</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Status Bar */}
      <div className="mt-8 flex justify-between items-center text-[9px] uppercase tracking-[0.3em] text-[#00F0FF] cyber-border p-3 px-6 bg-black/40 w-full z-20 relative">
         <div className="flex items-center gap-3">
           <AlertTriangle className="w-3.5 h-3.5 text-[#FF0055]" />
           <span className="text-[#FF0055] font-bold">Secure Connection: Stable</span>
         </div>
         <div className="font-bold text-white flex items-center gap-2">
           USER: {session?.user?.fullName ?? "COMMANDER NOVA"} <span className="text-slate-500 mx-2">|</span> {new Date().toLocaleTimeString('en-US', { timeZone: 'UTC' })} UTC
         </div>
      </div>
    </div>
  );
}
