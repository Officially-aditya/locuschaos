'use client';

import Sidebar from '@/components/Sidebar';

export default function Settings() {
  return (
    <>
      <Sidebar activePath="/settings" />
      <main className="ml-0 md:ml-64 flex-1 h-full flex flex-col p-6 md:p-8 gap-8 overflow-y-auto bg-surface relative z-10">
        
        <div className="w-full max-w-6xl mx-auto h-full flex flex-col gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-surface mb-2">Settings</h2>
            <p className="font-body text-base text-on-surface-variant">Manage connection defaults and application behaviors.</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] border border-outline-variant/20 p-8 flex flex-col md:flex-row gap-12">
             
             <div className="w-full md:w-1/3 flex flex-col gap-2">
                <span className="font-label font-bold text-sm text-on-surface uppercase tracking-wider">Default Vaults</span>
                <span className="font-body text-sm text-on-surface-variant">Your configured API keys are stored locally and never sent to our servers except during Chaos suite initialization.</span>
             </div>
             
             <div className="flex-1 flex flex-col gap-8">

               <div className="space-y-4">
                  <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="github_url">Saved GitHub Repo URL</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="link">link</span>
                    <input 
                      className="w-full pl-10 pr-4 py-3 bg-surface border-none rounded focus:ring-0 focus:border-primary-container focus:border-2 border-2 border-transparent text-on-surface font-body outline-none transition-colors" 
                      id="github_url" 
                      placeholder="https://github.com/org/repo" 
                      type="url"
                      defaultValue="https://github.com/my-org/my-target"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="api_key">Saved Locus API Key</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="key">key</span>
                    <input 
                      className="w-full pl-10 pr-4 py-3 bg-surface border-none rounded focus:ring-0 focus:border-primary-container focus:border-2 border-2 border-transparent text-on-surface font-mono outline-none transition-colors" 
                      id="api_key" 
                      placeholder="••••••••••••••••" 
                      type="password"
                      defaultValue="claw_dev_8f2a9"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                   <button className="bg-primary-container text-on-primary font-body font-medium py-3 px-8 rounded-lg flex items-center justify-center gap-2 hover:bg-primary transition-all duration-300 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
                      Save Changes
                   </button>
                </div>
             </div>

          </div>

          <div className="bg-error-container/20 rounded-xl border border-error/20 p-8 flex flex-col md:flex-row gap-12 mt-6">
             <div className="w-full md:w-1/3 flex flex-col gap-2">
                <span className="font-label font-bold text-sm text-error uppercase tracking-wider">Danger Zone</span>
                <span className="font-body text-sm text-error/80">Irreversible actions that completely wipe local states and cache.</span>
             </div>
             <div className="flex-1 flex flex-col items-start gap-4 justify-center">
                 <button className="bg-transparent border border-error text-error font-body font-medium py-3 px-6 rounded-lg hover:bg-error hover:text-white transition-colors">
                     Delete Local Configuration
                 </button>
             </div>
          </div>
          
        </div>
      </main>
    </>
  );
}
