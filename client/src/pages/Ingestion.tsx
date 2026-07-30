import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';

export default function Ingestion() {
  const queryClient = useQueryClient();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  const { data: datasetsData } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get('/datasets').then((r) => r.data.data),
  });

  const ingestMutation = useMutation({
    mutationFn: (data: any) => api.post('/ingest/records', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('datasetId', selectedDataset);
    formData.append('source', 'csv_upload');

    await api.post('/ingest/upload', formData);
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] } });

  const handleJsonIngest = (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError('');
    try {
      const data = JSON.parse(jsonInput);
      ingestMutation.mutate({ datasetId: selectedDataset, data, source: 'api' });
      setJsonInput('');
      setJsonError('');
    } catch {
      setJsonError('Please enter valid JSON. Check the format and try again.');
      return;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Data Ingestion" description="Ingest records with real-time deduplication" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Single Record Ingestion</h3>
          </div>
          <form onSubmit={handleJsonIngest} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Dataset</label>
              <select
                className="select"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                <option value="">Select dataset</option>
                {datasetsData?.datasets?.map((ds: any) => (
                  <option key={ds.datasetId} value={ds.datasetId}>{ds.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Record JSON</label>
              <textarea
                required
                rows={8}
                className="input font-mono text-sm resize-none"
                placeholder='{"email": "john@example.com", "firstName": "John", "lastName": "Doe"}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
            {jsonError && (
              <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {jsonError}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={ingestMutation.isPending || !selectedDataset}>
              {ingestMutation.isPending ? 'Ingesting...' : 'Ingest Record'}
            </button>
          </form>

          {ingestMutation.isSuccess && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-scale-in">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium capitalize">{ingestMutation.data.data?.classification?.replace('_', ' ') || 'Accepted'}</span>
              </div>
              <div className="text-xs text-emerald-300/80 ml-6 space-y-1">
                <div>Confidence: {ingestMutation.data.data?.confidence?.toFixed(1)}%</div>
                <div>{ingestMutation.data.data?.reason}</div>
                {ingestMutation.data.data?.recordId && <div>ID: {ingestMutation.data.data.recordId}</div>}
              </div>
            </div>
          )}
          {ingestMutation.isError && (ingestMutation.error as any)?.response?.status === 409 && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-scale-in">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="font-medium capitalize">{(ingestMutation.error as any).response.data.error?.data?.classification?.replace('_', ' ') || 'Duplicate'}</span>
              </div>
              <div className="text-xs text-red-300/80 ml-6 space-y-1">
                <div>Confidence: {(ingestMutation.error as any).response.data.error?.data?.confidence?.toFixed(1)}%</div>
                <div>{(ingestMutation.error as any).response.data.error?.data?.reason || (ingestMutation.error as any).response.data.error.message}</div>
              </div>
            </div>
          )}
          {ingestMutation.isError && (ingestMutation.error as any)?.response?.status === 422 && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm animate-scale-in">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">Validation Failed</span>
              </div>
              <div className="text-xs text-amber-300/80 ml-6 space-y-1">
                <div>Confidence: {(ingestMutation.error as any).response.data.error?.data?.confidence?.toFixed(1)}%</div>
                <div>{(ingestMutation.error as any).response.data.error?.data?.reason || 'Record failed schema validation.'}</div>
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Upload className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Bulk Upload</h3>
          </div>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
              ${isDragActive 
                ? 'border-indigo-500/50 bg-indigo-500/5' 
                : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragActive ? 'text-indigo-400' : 'text-slate-500'}`} />
            {isDragActive ? (
              <p className="text-indigo-400 font-medium">Drop CSV or JSON files here...</p>
            ) : (
              <>
                <p className="text-slate-300 font-medium">Drag & drop CSV or JSON files here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse</p>
              </>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
