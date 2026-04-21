export default function ScenarioRow({ scenario, label, status, metric, detail }: any) {
  const icons: any = {
    queued: <span className="material-symbols-outlined text-outline-variant text-[20px]">hourglass_empty</span>,
    running: <span className="material-symbols-outlined text-primary-container animate-pulse text-[20px]">sync</span>,
    passed: <span className="material-symbols-outlined text-[#00b34d] text-[20px]">check_circle</span>,
    failed: <span className="material-symbols-outlined text-error text-[20px]">cancel</span>,
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center">
          {icons[status] || icons.queued}
        </div>
        <div className="flex flex-col">
          <span className="font-body font-medium text-base text-on-surface">{label}</span>
          {detail && <span className="font-body text-xs text-outline mt-0.5">{detail}</span>}
        </div>
      </div>
      {metric && (
        <div className="font-mono text-lg text-on-surface font-semibold tracking-tight">
          {metric}
        </div>
      )}
    </div>
  )
}
