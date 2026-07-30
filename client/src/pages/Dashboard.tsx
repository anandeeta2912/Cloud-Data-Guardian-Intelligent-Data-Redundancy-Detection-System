import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity, Database, FileCheck, AlertTriangle, Upload, Clock, Gauge, Search } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import PageHeader from '../components/ui/PageHeader';

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-4 border border-white/10 shadow-2xl">
        <p className="text-sm text-slate-300 mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [search, setSearch] = useState('');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const { data: similarity } = useQuery({
    queryKey: ['analytics', 'similarity'],
    queryFn: () => api.get('/analytics/similarity').then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const { data: timeseries, isLoading: timeseriesLoading } = useQuery({
    queryKey: ['analytics', 'timeseries'],
    queryFn: () => api.get('/analytics/timeseries').then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['records', 'search', search],
    queryFn: () => api.get('/records', { params: { search, limit: '50' } }).then((r) => r.data.data),
    enabled: search.length > 0,
  });

  const stats = [
    { label: 'Total Ingested', value: overview?.totalIngested?.toLocaleString() || '0', icon: Upload, iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/10' },
    { label: 'Unique Records', value: overview?.totalUnique?.toLocaleString() || '0', icon: FileCheck, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    { label: 'Duplicates', value: overview?.totalDuplicates?.toLocaleString() || '0', icon: AlertTriangle, iconColor: 'text-red-400', iconBg: 'bg-red-500/10' },
    { label: 'Duplicate %', value: `${overview?.duplicatePercentage || 0}%`, icon: TrendingUp, iconColor: 'text-amber-400', iconBg: 'bg-amber-500/10' },
    { label: 'Avg Similarity', value: overview?.avgSimilarityScore ? `${(overview.avgSimilarityScore * 100).toFixed(1)}%` : '0%', icon: Gauge, iconColor: 'text-violet-400', iconBg: 'bg-violet-500/10' },
  ];

  const similarityData = similarity
    ? Object.entries(similarity).map(([range, count]) => ({ range, count: count as number }))
    : [];

  const sourceData = overview?.topSources?.map((s: any) => ({ name: s._id, value: s.count })) || [];
  const timeSeriesData = timeseries?.length > 0 ? timeseries : [];
  const recentActivity = overview?.recentActivity || [];

  const isSearchActive = search.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Monitor your data quality, track duplicate records, and analyze ingestion patterns in real-time."
        icon={TrendingUp}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} {...stat} delay={index * 100} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Ingestion Volume</h3>
                <p className="text-xs text-slate-400 mt-0.5">Records ingested over the last 30 days</p>
              </div>
            </div>
            <div className="h-80">
              {timeseriesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="space-y-3 w-full">
                    <div className="h-4 bg-white/5 rounded-lg w-3/4 animate-pulse" />
                    <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
                  </div>
                </div>
              ) : timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorIngest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#colorIngest)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No ingestion data available yet</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <AlertTriangle className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Similarity Distribution</h3>
                <p className="text-xs text-slate-400 mt-0.5">Duplicate confidence levels</p>
              </div>
            </div>
            <div className="h-80">
              {overviewLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="space-y-3 w-full">
                    <div className="h-4 bg-white/5 rounded-lg w-3/4 animate-pulse" />
                    <div className="h-48 bg-white/5 rounded-full animate-pulse mx-auto w-48" />
                  </div>
                </div>
              ) : similarityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={similarityData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={4}
                      dataKey="count"
                      stroke="none"
                    >
                      {similarityData.map((entry, index) => (
                        <Cell key={entry.range} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No similarity data yet</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {sourceData.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Database className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Duplicate Sources</h3>
              <p className="text-xs text-slate-400 mt-0.5">Top sources generating duplicates</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {recentActivity.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Latest ingested records</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Name, Email, Phone, Department, or record data..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Record Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingested At</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {(isSearchActive ? searchResults?.records : recentActivity).map((record: any) => (
                  <tr key={record._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">{record.source}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-slate-400">
                        {record.recordHash?.substring(0, 24)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(record.ingestedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        ingested
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isSearchActive && searchResults && searchResults.records && searchResults.records.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">No records match your search.</p>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
