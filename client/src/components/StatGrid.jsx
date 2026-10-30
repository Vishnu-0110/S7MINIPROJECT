export default function StatGrid({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="app-surface flex min-h-32 flex-col justify-between p-5 transition duration-200 hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            </div>
            {stat.icon ? <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><stat.icon className="h-5 w-5" /></div> : null}
          </div>
          {stat.note ? <p className="mt-3 text-xs font-medium text-slate-400">{stat.note}</p> : null}
        </div>
      ))}
    </div>
  );
}
