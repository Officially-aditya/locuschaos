'use client';

import Sidebar from '@/components/Sidebar';

export default function ChaosTests() {
  return (
    <>
      <Sidebar activePath="/chaos-tests" />
      <main className="ml-0 md:ml-64 flex-1 h-full flex flex-col p-6 md:p-8 gap-8 overflow-y-auto bg-surface relative z-10">
        
        <div className="w-full max-w-6xl mx-auto h-full flex flex-col gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-surface mb-2">Chaos Scenarios</h2>
            <p className="font-body text-base text-on-surface-variant">Configure and review available attack vectors in the LocusChaos suite.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            
            {/* Scenario Card Structure */}
            {[
              {
                id: 'cold_kill',
                label: 'Cold Kill',
                desc: 'Simulates a sudden unresponsive container termination. Validates target statelessness and recovery duration.',
                icon: 'power_settings_new'
              },
              {
                id: 'flood',
                label: 'Traffic Flood',
                desc: 'Floods public endpoints with asynchronous GET/POST spam requests to simulate a DDOS layer-7 attack.',
                icon: 'water_drop'
              },
              {
                id: 'env_corrupt',
                label: 'Env Corruption',
                desc: 'Unpredictably scrambles bound environment variables using the Locus Variables API.',
                icon: 'transform'
              },
              {
                id: 'db_drop',
                label: 'DB Constraint',
                desc: 'Simulates a severed connection to the bound PostgreSQL database addon.',
                icon: 'database'
              },
              {
                id: 'bad_deploy',
                label: 'Bad Deploy',
                desc: 'Forces a rapid mid-flight hot redeploy without completing initialization sequences.',
                icon: 'bug_report'
              }
            ].map((s) => (
              <div key={s.id} className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] p-6 border border-outline-variant/20 flex flex-col justify-between">
                <div className="flex gap-4 items-start mb-6">
                  <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-outline-variant text-[24px]">{s.icon}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-headline font-bold text-lg text-on-surface">{s.label}</h3>
                    <p className="font-body text-sm text-on-surface-variant leading-relaxed">{s.desc}</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-outline-variant/10 flex justify-between items-center mt-auto">
                    <span className="font-mono text-xs text-outline tracking-wider uppercase">ID: {s.id}</span>
                    <button className="font-body font-medium text-sm text-primary hover:text-primary-container transition-colors">Configure</button>
                </div>
              </div>
            ))}
            
          </div>
        </div>
        
      </main>
    </>
  );
}
