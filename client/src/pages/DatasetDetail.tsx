import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, FileCheck, AlertTriangle, Gauge, Clock, Trash2, RefreshCw } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useState } from 'react';

export default function DatasetDetail() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => api.get(`/datasets/${datasetId}`).then((r) => r.data.data),
    enabled: !!datasetId,
  });

  const { data: stats } = useQuery({
    queryKey: ['analytics', 'dataset', datasetId],
    queryFn: () => api.get(`/analytics/datasets/${datasetId}`).then((r) => r.data.data),
    enabled: !!datasetId,
  });

  const handleArchive = async () => {
    if (!datasetId) return;
    setActionLoading('archive');
    try {
      await api.delete(`/datasets/${datasetId}`);
      navigate('/datasets');
    } catch (error) {
      console.error('Failed to archive dataset:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (datasetLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-white/5 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dataset Not Found" description="The requested dataset could not be found." />
        <GlassCard>
          <EmptyState
            icon={Database}
            title="Dataset not found"
            description="The dataset you're looking for doesn't exist or you don't have access to it."
            action={
              <button onClick={() => navigate('/datasets')} className="btn btn-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Datasets
              </button>
            }
          />
        </GlassCard>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Records', value: stats?.totalRecords?.toLocaleString() || '0', icon: FileCheck, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    { label: 'Total Duplicates', value: stats?.totalDuplicates?.toLocaleString() || '0', icon: AlertTriangle, iconColor: 'text-red-400', iconBg: 'bg-red-500/10' },
    { label: 'Duplicate Rate', value: `${stats?.duplicatePercentage || '0.00'}%`, icon: Gauge, iconColor: 'text-amber-400', iconBg: 'bg-amber-500/10' },
    { label: 'Last Ingested', value: stats?.lastIngestedAt ? new Date(stats.lastIngestedAt).toLocaleDateString() : 'Never', icon: Clock, iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={dataset.name}
        description={dataset.slug}
        breadcrumb={[
          { label: 'Datasets', href: '/datasets' },
          { label: dataset.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/ingestion')}
              className="btn btn-secondary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Ingest Data
            </button>
            <button
              onClick={handleArchive}
              disabled={actionLoading === 'archive'}
              className="btn btn-danger"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {actionLoading === 'archive' ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.label} {...stat} delay={index * 100} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Dataset Information</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/[0.08]">
              <span className="text-sm text-slate-400">Status</span>
              <Badge variant={dataset.status === 'active' ? 'success' : 'default'}>{dataset.status}</Badge>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/[0.08]">
              <span className="text-sm text-slate-400">Created</span>
              <span className="text-sm text-white font-medium">{dataset.createdAt ? new Date(dataset.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-400">Retention</span>
              <span className="text-sm text-white font-medium">{dataset.retentionDays || 365} days</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Deduplication Rules</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Primary Key Fields</p>
              <div className="flex flex-wrap gap-2">
                {(dataset.primaryKeyFields || []).map((field: string) => (
                  <span key={field} className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {field}
                  </span>
                ))}
                {(!dataset.primaryKeyFields || dataset.primaryKeyFields.length === 0) && (
                  <span className="text-sm text-slate-500">No primary key fields configured</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Fuzzy Match Rules</p>
              <div className="space-y-2">
                {(dataset.fuzzyMatchRules || []).map((rule: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-sm text-slate-300 font-mono">{rule.field}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{rule.algorithm}</span>
                      <span className="text-xs text-slate-400">threshold: {rule.threshold}</span>
                    </div>
                  </div>
                ))}
                {(!dataset.fuzzyMatchRules || dataset.fuzzyMatchRules.length === 0) && (
                  <span className="text-sm text-slate-500">No fuzzy match rules configured</span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
