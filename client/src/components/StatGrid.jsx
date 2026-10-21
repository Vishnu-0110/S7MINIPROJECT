export default function StatGrid({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-white bg-white p-5 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.45)]">
          <div className="absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-primary/10 transition group-hover:scale-125" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            </div>
            {stat.icon ? <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><stat.icon className="h-5 w-5" /></div> : null}
          </div>
          {stat.note ? <p className="relative mt-3 text-xs font-medium text-slate-400">{stat.note}</p> : null}
        </div>
      ))}
    </div>
  );
}
