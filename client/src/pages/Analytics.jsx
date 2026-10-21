import { BarChart, Bar, CartesianGrid, Cell, LineChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LoadingState from "../components/LoadingState.jsx";
import StatGrid from "../components/StatGrid.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

const palette = ["#0f766e", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"];

export default function Analytics() {
  const { data, loading, error } = useApiResource("/analytics");
  if (loading) return <LoadingState />;
  const analytics = data || {};

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Analytics</h2>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <StatGrid
        stats={[
          { label: "Distance", value: `${Math.round(analytics.carbon?.distance || 0)} km`, note: "From completed trips" },
          { label: "Carbon footprint", value: `${Math.round(analytics.carbon?.estimatedKgCo2 || 0)} kg`, note: "Estimated CO2" },
          { label: "Trip statuses", value: analytics.tripStatus?.length || 0, note: "Workflow states" },
          { label: "Expense groups", value: analytics.expenses?.length || 0, note: "Cost categories" }
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Monthly trips">
          <ResponsiveContainer height={260}>
            <LineChart margin={{ top: 8, right: 8, left: -20, bottom: 4 }} data={(analytics.monthlyTrips || []).map((item) => ({ name: `${item._id.month}/${item._id.year}`, trips: item.trips }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="trips" stroke="#0f766e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Trip status">
          <ResponsiveContainer height={260}>
            <PieChart>
              <Pie data={analytics.tripStatus || []} dataKey="count" nameKey="_id" outerRadius={90}>
                {(analytics.tripStatus || []).map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Vehicle utilization">
          <ResponsiveContainer height={260}>
            <BarChart margin={{ top: 8, right: 8, left: -20, bottom: 4 }} data={(analytics.vehicleUtilization || []).map((item) => ({ status: item._id, count: item.count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Expenses">
          <ResponsiveContainer height={260}>
            <BarChart margin={{ top: 8, right: 8, left: -20, bottom: 4 }} data={(analytics.expenses || []).map((item) => ({ category: item._id, total: item.total }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-frame">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </div>
  );
}
