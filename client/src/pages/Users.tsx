import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Mail, Shield, UserMinus } from 'lucide-react';
import api from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import PageHeader from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

export default function Users() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'viewer' });

  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.post('/users/invite', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'viewer' });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(inviteForm);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Users" 
        description="Manage workspace members and permissions"
        action={
          <button onClick={() => setShowInvite(true)} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </button>
        }
      />

      {showInvite && (
        <GlassCard className="p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-white mb-6">Invite User</h3>
          <form onSubmit={handleInvite} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="john@acme.com"
              />
              <Input
                label="Name"
                required
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Role</label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <select
                  className="select pl-11"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn btn-primary" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        {data?.users?.length === 0 ? (
          <EmptyState 
            icon={Mail} 
            title="No team members" 
            description="Invite your first team member to collaborate on data quality."
            action={
              <button onClick={() => setShowInvite(true)} className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Invite User
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data?.users?.map((user: any) => (
                  <tr key={user.userId} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="info" className="capitalize">{user.role}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1.5 transition-colors">
                        <UserMinus className="w-4 h-4" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
