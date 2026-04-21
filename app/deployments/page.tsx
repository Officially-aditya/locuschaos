'use client';

import Sidebar from '@/components/Sidebar';

export default function Deployments() {
  return (
    <>
      <Sidebar activePath="/deployments" />
      <main className="ml-0 md:ml-64 flex-1 h-full flex flex-col p-6 md:p-8 gap-8 overflow-y-auto bg-surface relative z-10">
        
        <div className="w-full max-w-6xl mx-auto h-full flex flex-col gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-surface mb-2">Deployments</h2>
            <p className="font-body text-base text-on-surface-variant">Locus Infrastructure and provisioning history logs.</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] border border-outline-variant/20 p-8 flex flex-col gap-8">
             
             {/* Header */}
             <div className="flex items-center justify-between">
               <h3 className="font-headline font-bold text-xl text-on-surface">Recent Scaffolding</h3>
               <button className="flex items-center gap-2 text-primary hover:text-primary-container font-body font-medium text-sm transition-colors border border-outline-variant/20 py-2 px-4 rounded-lg">
                 <span className="material-symbols-outlined text-[18px]">sync</span>
                 Refresh
               </button>
             </div>

             {/* Skeleton Log Items to simulate 'Precise Curator' list style */}
             <div className="flex flex-col gap-6">
                {[1,2,3].map((i) => (
                  <div key={i} className="flex items-center gap-6 pb-6 border-b border-outline-variant/10 last:border-0 last:pb-0">
                    <div className="font-mono text-xs text-outline w-32 shrink-0">
                      {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <span className="font-body text-base font-medium text-on-surface">locuschaos-sandbox-{i}</span>
                      <span className="font-body text-sm text-on-surface-variant">Branch: main &bull; Addon: Postgres 15</span>
                    </div>
                    <div className="w-24 text-right">
                      {i === 1 ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-body font-bold uppercase tracking-wider">
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-body font-bold uppercase tracking-wider">
                          Destroyed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
             </div>

          </div>
        </div>
      </main>
    </>
  );
}
