import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, X, CheckCircle, XCircle, GitMerge, Search, Filter } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { Select } from '../components/ui/Input';

export default function Duplicates() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    matchType: '',
    classification: '',
    datasetId: '',
    source: '',
    search: '',
    startDate: '',
    endDate: '',
    page: '1',
    limit: '20',
  });
  const [selectedDuplicate, setSelectedDuplicate] = useState<any>(null);

  const { data: datasetsData } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get('/datasets').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['duplicates', filters],
    queryFn: () => {
      const params: any = { ...filters };
      if (!params.matchType) delete params.matchType;
      if (!params.classification) delete params.classification;
      if (!params.datasetId) delete params.datasetId;
      if (!params.source) delete params.source;
      if (!params.search) delete params.search;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;
      return api.get('/duplicates', { params }).then((r) => r.data.data);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ duplicateId, action, notes }: { duplicateId: string; action: string; notes?: string }) =>
      api.patch(`/duplicates/${duplicateId}/review`, { action, notes }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setSelectedDuplicate(null);
    },
  });

  const duplicates = data?.duplicates || [];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: '1' }));
  };

  const handleReview = (action: string) => {
    if (!selectedDuplicate) return;
    reviewMutation.mutate({ duplicateId: selectedDuplicate._id, action });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicate Logs"
        description="Review rejected records, analyze similarity scores, and manage duplicate detection rules."
        icon={Filter}
      />

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search hash or reason..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
            />
          </div>
          <Select
            label=""
            options={[
              { value: '', label: 'All match types' },
              { value: 'exact', label: 'Exact' },
              { value: 'fuzzy', label: 'Fuzzy' },
              { value: 'semantic', label: 'Semantic' },
            ]}
            value={filters.matchType}
            onChange={(e) => handleFilterChange('matchType', e.target.value)}
          />
          <Select
            label=""
            options={[
              { value: '', label: 'All classifications' },
              { value: 'exact_duplicate', label: 'Exact Duplicate' },
              { value: 'near_duplicate', label: 'Near Duplicate' },
              { value: 'false_positive', label: 'False Positive' },
              { value: 'unique', label: 'Unique' },
            ]}
            value={filters.classification}
            onChange={(e) => handleFilterChange('classification', e.target.value)}
          />
          <Select
            label=""
            options={[
              { value: '', label: 'All datasets' },
              ...(datasetsData?.datasets || []).map((ds: any) => ({ value: ds.datasetId, label: ds.name })),
            ]}
            value={filters.datasetId}
            onChange={(e) => handleFilterChange('datasetId', e.target.value)}
          />
          <input
            type="text"
            placeholder="Source..."
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
          />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <LoadingSkeleton key={i} className="h-14" />
            ))}
          </div>
        ) : duplicates.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No duplicates found"
            description="All ingested records are unique. Great job maintaining data quality!"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Classification</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Match Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingested At</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {duplicates.map((dup: any) => (
                  <tr key={dup._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        dot
                        variant={dup.classification === 'exact_duplicate' ? 'danger' : dup.classification === 'near_duplicate' ? 'warning' : dup.classification === 'unique' ? 'success' : 'info'}
                      >
                        {dup.classification?.replace('_', ' ') || dup.matchType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${dup.confidence || 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-400 w-10 font-mono">
                          {(dup.confidence || 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-400 capitalize">{dup.matchType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{dup.source}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(dup.ingestedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedDuplicate(dup)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {selectedDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Duplicate Found</h3>
              <button onClick={() => setSelectedDuplicate(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Reason</p>
                <p className="text-sm text-white">{selectedDuplicate.classificationReason || selectedDuplicate.rejectionReason}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Similarity</p>
                <p className="text-sm text-white font-mono">{((selectedDuplicate.similarityScore || 0) * 100).toFixed(1)}%</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Classification</p>
                <Badge variant={selectedDuplicate.classification === 'exact_duplicate' ? 'danger' : selectedDuplicate.classification === 'near_duplicate' ? 'warning' : selectedDuplicate.classification === 'unique' ? 'success' : 'info'}>
                  {selectedDuplicate.classification?.replace('_', ' ') || selectedDuplicate.matchType}
                </Badge>
              </div>

              {selectedDuplicate.classification === 'false_positive' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                  <p className="text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wider">Recommendation</p>
                  <p className="text-sm text-indigo-300">Review Manually</p>
                </div>
              )}

              {selectedDuplicate.fieldBreakdown && (
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Field Breakdown</p>
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2">
                    {Object.entries(selectedDuplicate.fieldBreakdown).map(([field, info]: [string, any]) => (
                      <div key={field} className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-mono">{field}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{info.algorithm}</span>
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${info.score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-10 text-right">{(info.score * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Duplicate Data</p>
                <pre className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedDuplicate.data, null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Record Hash</p>
                <p className="text-sm text-white font-mono break-all">{selectedDuplicate.recordHash}</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  onClick={() => handleReview('accepted_as_unique')}
                  disabled={reviewMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept as Unique
                </button>
                <button
                  onClick={() => handleReview('force_merged')}
                  disabled={reviewMutation.isPending}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <GitMerge className="w-4 h-4" />
                  Force Merge
                </button>
                <button
                  onClick={() => handleReview('dismissed')}
                  disabled={reviewMutation.isPending}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Dismiss
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
