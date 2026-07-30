import { useState } from 'react';
import { Save, Bell, Shield, Cloud } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';

export default function Settings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    slackNotifications: false,
    defaultThreshold: 0.85,
    dataRetentionDays: 365,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure workspace preferences and defaults" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
          </div>
          <div className="space-y-5">
            <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] cursor-pointer hover:bg-white/[0.04] transition-colors">
              <div>
                <span className="text-sm text-white block">Email Notifications</span>
                <span className="text-xs text-slate-500">Receive alerts via email</span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${settings.emailNotifications ? 'bg-indigo-500' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${settings.emailNotifications ? 'translate-x-5' : 'translate-x-1'}`} style={{ marginTop: '4px' }}></div>
                </div>
              </div>
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] cursor-pointer hover:bg-white/[0.04] transition-colors">
              <div>
                <span className="text-sm text-white block">Slack Notifications</span>
                <span className="text-xs text-slate-500">Send alerts to Slack</span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.slackNotifications}
                  onChange={(e) => setSettings({ ...settings, slackNotifications: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${settings.slackNotifications ? 'bg-indigo-500' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${settings.slackNotifications ? 'translate-x-5' : 'translate-x-1'}`} style={{ marginTop: '4px' }}></div>
                </div>
              </div>
            </label>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Deduplication</h3>
          </div>
          <div className="space-y-5">
            <Input
              label="Default Similarity Threshold"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={settings.defaultThreshold}
              onChange={(e) => setSettings({ ...settings, defaultThreshold: parseFloat(e.target.value) })}
            />
            <Input
              label="Data Retention (Days)"
              type="number"
              min="1"
              value={settings.dataRetentionDays}
              onChange={(e) => setSettings({ ...settings, dataRetentionDays: parseInt(e.target.value) })}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Cloud className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Cloud Destination</h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">Configure your cloud warehouse destination for deduplicated data sync.</p>
          <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Cloud className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Not configured</p>
                <p className="text-xs text-slate-500">Connect a cloud warehouse</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
