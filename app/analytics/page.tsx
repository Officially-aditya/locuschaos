'use client';

import Sidebar from '@/components/Sidebar';

export default function Analytics() {
  return (
    <>
      <Sidebar activePath="/analytics" />
      <main className="ml-0 md:ml-64 flex-1 h-full flex flex-col p-6 md:p-8 gap-8 overflow-y-auto bg-surface relative z-10">
        
        <div className="w-full max-w-6xl mx-auto h-full flex flex-col gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-surface mb-2">Analytics</h2>
            <p className="font-body text-base text-on-surface-variant">Macro-level resilience statistics over time.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            
            {/* Metric Blocks */}
            {[
              { label: 'Total Runs', value: '47', delta: '+12%', type: 'positive' },
              { label: 'Avg Recovery', value: '2.4s', delta: '-0.3s', type: 'positive' },
              { label: 'Critical Fails', value: '11', delta: '+2', type: 'negative' },
              { label: 'Uptime Grade', value: 'B+', delta: 'Stable', type: 'neutral' },
            ].map((m, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] border border-outline-variant/20 p-8 flex flex-col gap-6">
                 <span className="font-label text-sm uppercase tracking-wider text-outline font-bold">{m.label}</span>
                 <div className="font-mono text-5xl font-black text-on-surface tracking-tighter">{m.value}</div>
                 <div className={`font-body text-sm font-semibold tracking-wide ${m.type === 'positive' ? 'text-[#00b34d]' : m.type === 'negative' ? 'text-error' : 'text-on-surface-variant'}`}>{m.delta} this month</div>
              </div>
            ))}

          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] border border-outline-variant/20 p-8 flex flex-col gap-8 h-96 mt-6 relative overflow-hidden">
              <h3 className="font-headline font-bold text-xl text-on-surface">Uptime Trajectory</h3>
              
              <div className="absolute inset-x-8 bottom-8 top-24 flex items-end gap-2">
                 {/* Fake Bar Chart */}
                 {[40, 60, 45, 80, 50, 90, 70, 85, 30, 50, 75, 95].map((h, i) => (
                   <div key={i} className="flex-1 bg-surface-container rounded-t-DEFAULT transition-all duration-500 ease-in hover:bg-primary-container/20 group relative" style={{ height: `${h}%` }}>
                     <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-inverse-surface text-inverse-on-surface text-xs font-mono py-1 px-3 rounded shadow-lg whitespace-nowrap transition-opacity">{h}% Uptime</div>
                   </div>
                 ))}
              </div>
          </div>
          
        </div>
      </main>
    </>
  );
}
