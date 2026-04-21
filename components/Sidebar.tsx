import Link from 'next/link';

export default function Sidebar({ activePath = '/' }: { activePath?: string }) {
  const navItems = [
    { name: 'New Run', path: '/new-run', icon: 'dashboard' },
    { name: 'History', path: '/dashboard', icon: 'history' },
    { name: 'Chaos Tests', path: '/chaos-tests', icon: 'bolt' },
    { name: 'Deployments', path: '/deployments', icon: 'rocket_launch' },
    { name: 'Analytics', path: '/analytics', icon: 'bar_chart' },
    { name: 'Settings', path: '/settings', icon: 'settings_accessibility' },
  ];

  return (
    <nav className="h-screen w-64 fixed left-0 top-0 flex flex-col py-8 bg-surface-container-low hidden md:flex z-40 border-r border-outline-variant/10">
      <div className="px-6 mb-10">
        <h1 className="font-headline font-black text-on-surface text-2xl tracking-tight">LocusChaos</h1>
        <p className="font-body text-xs text-on-surface-variant mt-1">Tracked resilience drills</p>
      </div>
      <div className="flex-1 flex flex-col gap-2 px-2">
        {navItems.map((item) => {
          const isActive = activePath === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`flex items-center gap-3 py-3 px-4 group transition-all duration-200 ease-in-out relative bg-transparent ${isActive ? 'text-primary-container' : 'text-on-surface-variant hover:text-primary-container'}`}
            >
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-lg transition-colors ${isActive ? 'bg-primary-container' : 'bg-transparent group-hover:bg-primary-container/30'}`}></div>
              <span className="material-symbols-outlined text-[20px]" data-icon={item.icon}>{item.icon}</span>
              <span className="font-body font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </div>
      <div className="px-4 mt-auto">
        <Link href="/new-run">
            <button 
            type="button"
            className="w-full py-3 px-4 bg-primary-container text-on-primary rounded-lg font-body font-medium text-sm hover:bg-primary transition-all shadow-[0_12px_40px_rgba(27,0,99,0.06)] hover:shadow-[0_20px_40px_rgba(27,0,99,0.12)]">
            Run Chaos Suite
            </button>
        </Link>
      </div>
    </nav>
  );
}
