import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { Database } from 'lucide-react';

export default function Datasets() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', schemaDefinition: {} });

  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get('/datasets').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/datasets', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      setShowCreate(false);
      setFormData({ name: '', slug: '', schemaDefinition: {} });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Datasets" 
        description="Manage your data schemas and deduplication rules"
        action={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Dataset
          </button>
        }
      />

      {showCreate && (
        <GlassCard className="p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-white mb-6">Create Dataset</h3>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="Customer Leads Q3"
              />
              <Input
                label="Slug"
                required
                pattern="[a-z0-9-]+"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="customer-leads-q3"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Dataset'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </GlassCard>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <LoadingSkeleton key={i} className="h-48" />
          ))}
        </div>
      ) : data?.datasets?.length === 0 ? (
        <GlassCard>
          <EmptyState 
            icon={Database} 
            title="No datasets yet" 
            description="Create your first dataset to start ingesting and deduplicating data."
            action={
              <button onClick={() => setShowCreate(true)} className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Dataset
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.datasets?.map((ds: any, index: number) => (
            <Link 
              key={ds.datasetId} 
              to={`/datasets/${ds.datasetId}`}
              className="block"
            >
              <GlassCard 
                hover 
                className="p-6 animate-slide-up cursor-pointer"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
              >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Database className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{ds.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{ds.slug}</p>
                  </div>
                </div>
                <Badge variant={ds.status === 'active' ? 'success' : 'default'}>
                  {ds.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <p className="text-xs text-slate-500 mb-1">Records</p>
                  <p className="text-lg font-semibold text-white">{ds.totalRecords?.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <p className="text-xs text-slate-500 mb-1">Duplicates</p>
                  <p className="text-lg font-semibold text-white">{ds.totalDuplicates?.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
