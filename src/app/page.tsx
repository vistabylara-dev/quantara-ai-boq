import Link from "next/link";
import { demoProjects } from "@/data/demo-projects";
import { demoIndustries } from "@/config/industries";
import { ChevronRight, Terminal, Cpu, Database, Network } from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-void min-h-screen text-slate-300 font-sans selection:bg-[#00F0FF]/30 overflow-x-hidden">
      <div className="scanline"></div>

      {/* Hero / Act 1: The Nexus */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-4 py-20 overflow-hidden">
        {/* Background Neural Grid */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40">
          <div className="w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.1)_0%,transparent_70%)] rounded-full blur-3xl absolute"></div>
          <div className="w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(255,0,85,0.05)_0%,transparent_70%)] rounded-full blur-2xl absolute translate-x-32 translate-y-32"></div>
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 border border-[#00F0FF]/30 rounded-full bg-[#00F0FF]/5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
            <span className="terminal-text text-xs text-[#00F0FF] uppercase tracking-[0.2em]">Quantara Core // Online</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            The Intelligent <br />
            <span className="text-cyan-glow">Foundation</span> for Modern BOQs
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light">
            Move beyond fragmented spreadsheets. Assimilate your project data into a resilient, blazingly fast workspace powered by structural intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/dashboard" className="group relative inline-flex items-center justify-center px-8 py-4 bg-[#00F0FF] text-[#030508] font-bold uppercase tracking-widest text-sm hover:bg-white transition-all duration-300">
              <span>Initialize Workspace</span>
              <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/projects" className="inline-flex items-center justify-center px-8 py-4 border border-slate-700 text-slate-300 font-medium uppercase tracking-widest text-sm hover:border-[#00F0FF]/50 hover:text-[#00F0FF] transition-all duration-300 bg-black/20 backdrop-blur-md">
              Access Terminal
            </Link>
          </div>
        </div>
      </section>

      {/* Act 2: Data Assimilation */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="terminal-text text-[#FF0055] text-sm uppercase tracking-[0.3em] mb-4">Phase 01 // Assimilation</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">Ingest chaos. <br/>Output structure.</h3>
            <p className="text-slate-400 text-lg mb-8">
              Raw drawings, disjointed spreadsheets, and legacy specifications are absorbed by the Quantara Engine, transforming unstructured noise into a precise, queryable neural grid.
            </p>
            <ul className="space-y-4">
              {[
                { icon: Database, text: "Unstructured data parsing" },
                { icon: Network, text: "Semantic relationship mapping" },
                { icon: Cpu, text: "Real-time anomaly detection" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-sm border border-[#00F0FF]/20 flex items-center justify-center bg-[#00F0FF]/5">
                    <item.icon className="w-5 h-5 text-[#00F0FF]" />
                  </div>
                  <span className="terminal-text text-sm">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-square md:aspect-video lg:aspect-square">
            <div className="absolute inset-0 cyber-panel cyber-border rounded-lg p-6 flex flex-col">
               <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                 <div className="flex gap-2">
                   <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                   <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                   <div className="w-3 h-3 rounded-full bg-[#FF0055]"></div>
                 </div>
                 <span className="terminal-text text-xs text-slate-500">SYS_LOG // RAW_INGEST</span>
               </div>
               <div className="flex-1 terminal-text text-xs text-slate-400 space-y-2 overflow-hidden">
                 <p>{`> [SYS] Establishing uplink to data node...`}</p>
                 <p className="text-[#00F0FF]">{`> [SYS] Uplink established. Latency: 12ms`}</p>
                 <p>{`> [INGEST] Parsing structural.pdf (32MB)`}</p>
                 <p>{`> [INGEST] Identifying slab geometries...`}</p>
                 <p>{`> [ENGINE] 1,204 entities extracted. 0 anomalies.`}</p>
                 <p className="text-[#FF0055]">{`> [WARN] Legacy spreadsheet detected. Normalizing schema...`}</p>
                 <p className="text-[#00F0FF]">{`> [SYS] Schema normalized. BOQ structured.`}</p>
                 <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-white font-bold">DATA.STATE</span>
                    <span className="text-[#00F0FF] px-2 py-1 bg-[#00F0FF]/10 rounded-sm">STRUCTURED</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Act 3: The AI Core */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="terminal-text text-[#00F0FF] text-sm uppercase tracking-[0.3em] mb-4">Phase 02 // Processing</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-white">The Neural Architecture</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="cyber-panel cyber-border p-8 rounded-lg group hover:border-[#FF0055]/50 transition-colors">
            <Terminal className="w-8 h-8 text-[#FF0055] mb-6 group-hover:scale-110 transition-transform" />
            <h4 className="text-lg font-bold text-white mb-3">Industry Engines</h4>
            <p className="text-slate-400 text-sm">
              Pre-trained validation nodes tailored for specific trades. Ensuring compliance and semantic integrity across {demoIndustries.length} industry schemas.
            </p>
          </div>
          <div className="cyber-panel cyber-border p-8 rounded-lg group hover:border-[#00F0FF]/50 transition-colors">
            <Database className="w-8 h-8 text-[#00F0FF] mb-6 group-hover:scale-110 transition-transform" />
            <h4 className="text-lg font-bold text-white mb-3">Local Persistence</h4>
            <p className="text-slate-400 text-sm">
              Data sovereignty maintained. Distributed ledger capabilities ensure zero data loss and blazing fast retrieval for active project nodes.
            </p>
          </div>
          <div className="cyber-panel cyber-border p-8 rounded-lg group hover:border-[#00F0FF]/50 transition-colors">
             <Network className="w-8 h-8 text-[#00F0FF] mb-6 group-hover:scale-110 transition-transform" />
             <h4 className="text-lg font-bold text-white mb-3">Active Samples</h4>
             <p className="text-slate-400 text-sm">
               Real-time simulation. Currently tracking {demoProjects.length} live project states with predictive cost rendering and spatial analysis.
             </p>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/10 py-12 text-center">
        <p className="terminal-text text-xs text-slate-600 uppercase tracking-widest">Quantara AI // System V.1.0 // Operational</p>
      </footer>
    </div>
  );
}
