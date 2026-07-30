import { useState, useCallback } from 'react';
import { Download, FileSpreadsheet, FileText, XCircle } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';

export default function Reports() {
  const [datasetId, setDatasetId] = useState('');
  const [reportType, setReportType] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (!datasetId) return;
    setError(null);
    try {
      const response = await api.get(`/reports/${reportType}/${datasetId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = reportType === 'excel' ? 'xlsx' : reportType;
      link.setAttribute('download', `${datasetId}_report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Report download failed. Please check the dataset ID and try again.');
      console.error('Report download failed:', err);
    }
  }, [datasetId, reportType]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and export data quality reports" />

      <GlassCard className="max-w-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Generate Report</h3>
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <div className="space-y-5">
          <Input
            label="Dataset ID"
            placeholder="dataset_123"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-slate-300 mb-3 block">Format</label>
            <div className="flex gap-3">
              {(['csv', 'excel', 'pdf'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setReportType(format)}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-300
                    ${reportType === format 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                      : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/20'
                    }
                  `}
                >
                  {format === 'csv' && <FileText className="w-4 h-4" />}
                  {format === 'excel' && <FileSpreadsheet className="w-4 h-4" />}
                  {format === 'pdf' && <FileText className="w-4 h-4" />}
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleDownload} className="btn btn-primary w-full" disabled={!datasetId}>
            <Download className="w-4 h-4 mr-2" />
            Generate & Download
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
