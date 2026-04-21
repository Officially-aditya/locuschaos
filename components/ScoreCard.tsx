export default function ScoreCard({ scoreData }: any) {
  if (!scoreData) return null;

  const { grade, points, total, verdicts } = scoreData;
  const gradeColors: any = {
    A: 'text-[#00b34d]',
    B: 'text-primary-container',
    C: 'text-[#b0a2fd]',
    D: 'text-tertiary-container',
    F: 'text-error'
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-headline font-bold text-xl text-on-surface mb-4">Resilience Report</h2>
        <div className="flex items-center gap-6">
          <div className={`font-mono text-7xl font-black tracking-tighter ${gradeColors[grade] || 'text-on-surface'}`}>
            {grade}
          </div>
          <div className="font-mono text-on-surface-variant text-xl font-medium tracking-tight">
            {points} / {total} Points
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 mt-4 pt-6 box-border relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-outline-variant/0 via-outline-variant/20 to-outline-variant/0"></div>
        {Object.entries(verdicts).map(([key, description]: any) => (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="font-label text-sm uppercase tracking-wider text-on-surface font-bold">{key.replace('_', ' ')}</span>
            <span className="font-body text-sm text-on-surface-variant max-w-lg leading-relaxed">{description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
