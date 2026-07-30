import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Database, Mail, Lock, Building2, User, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import Spinner from '../components/ui/Spinner';

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    tenantName: '',
    tenantSlug: '',
    industry: 'generic',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const setAuth = useAuthStore((s) => s.setAuth);

  const registerMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.tokens.accessToken, data.data.tokens.refreshToken);
      navigate('/');
    },
    onError: (error: any) => {
      setFieldErrors({});
      const err = error?.response?.data?.error;
      if (err?.code === 'VALIDATION_ERROR' && err?.data?.errors) {
        const errors: Record<string, string> = {};
        err.data.errors.forEach((e: any) => {
          errors[e.field] = e.message;
        });
        setFieldErrors(errors);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (!formData.tenantName.trim()) errors.tenantName = 'Workspace name is required.';
    else if (formData.tenantName.trim().length < 2) errors.tenantName = 'Workspace name must be at least 2 characters.';
    if (!formData.tenantSlug.trim()) errors.tenantSlug = 'Workspace slug is required.';
    else if (formData.tenantSlug.trim().length < 2) errors.tenantSlug = 'Slug must be at least 2 characters.';
    else if (!/^[a-z0-9-]+$/.test(formData.tenantSlug)) errors.tenantSlug = 'Use lowercase letters, numbers, and hyphens only (e.g. acme-corp).';
    if (!formData.adminName.trim()) errors.adminName = 'Your name is required.';
    else if (formData.adminName.trim().length < 2) errors.adminName = 'Name must be at least 2 characters.';
    if (!formData.adminEmail.trim()) errors.adminEmail = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) errors.adminEmail = 'Please enter a valid email address.';
    if (!formData.adminPassword) errors.adminPassword = 'Password is required.';
    else if (formData.adminPassword.length < 8) errors.adminPassword = 'Password must be at least 8 characters.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    registerMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden py-12 px-4">
      <div className="absolute inset-0 bg-gradient-glow"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] animate-float"></div>
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px] animate-float" style={{ animationDelay: '3s' }}></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-slide-up">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6">
            <Database className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Get started with CloudData Guardian</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 shadow-2xl animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          {registerMutation.isError && !registerMutation.error?.response?.data?.error?.data?.errors && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-scale-in">
              {(registerMutation.error as any)?.response?.data?.error?.message || 'Registration failed.'}
            </div>
          )}

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-tenant-name" className="text-sm font-medium text-slate-300">Workspace Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                    <input
                      id="register-tenant-name"
                      type="text"
                      required
                      title="Enter your workspace name, e.g. Acme Corp"
                      className={`input pl-11 ${fieldErrors['tenantName'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                      placeholder="Acme Corp"
                      value={formData.tenantName}
                      onChange={(e) => { setFormData({ ...formData, tenantName: e.target.value }); if (fieldErrors['tenantName']) setFieldErrors((prev) => { const next = { ...prev }; delete next['tenantName']; return next; }); }}
                    />
                  </div>
                  {fieldErrors['tenantName'] && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-400" />
                      {fieldErrors['tenantName']}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-slug" className="text-sm font-medium text-slate-300">Slug</label>
                  <input
                    id="register-slug"
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    title="Use lowercase letters, numbers, and hyphens only (e.g. acme-corp)"
                    className={`input ${fieldErrors['tenantSlug'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                    placeholder="acme-corp"
                    value={formData.tenantSlug}
                    onChange={(e) => { setFormData({ ...formData, tenantSlug: e.target.value.toLowerCase().replace(/\s+/g, '-') }); if (fieldErrors['tenantSlug']) setFieldErrors((prev) => { const next = { ...prev }; delete next['tenantSlug']; return next; }); }}
                  />
                  {fieldErrors['tenantSlug'] && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-400" />
                      {fieldErrors['tenantSlug']}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-name" className="text-sm font-medium text-slate-300">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    title="Enter your full name, e.g. Jane Doe"
                    className={`input pl-11 ${fieldErrors['adminName'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                    placeholder="Jane Doe"
                    value={formData.adminName}
                    onChange={(e) => { setFormData({ ...formData, adminName: e.target.value }); if (fieldErrors['adminName']) setFieldErrors((prev) => { const next = { ...prev }; delete next['adminName']; return next; }); }}
                  />
                </div>
                {fieldErrors['adminName'] && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-400" />
                    {fieldErrors['adminName']}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <input
                  id="register-email"
                  type="email"
                  required
                  title="Enter a valid email address"
                  className={`input pl-11 ${fieldErrors['adminEmail'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                  placeholder="jane@acme.com"
                  value={formData.adminEmail}
                  onChange={(e) => { setFormData({ ...formData, adminEmail: e.target.value }); if (fieldErrors['adminEmail']) setFieldErrors((prev) => { const next = { ...prev }; delete next['adminEmail']; return next; }); }}
                />
              </div>
              {fieldErrors['adminEmail'] && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {fieldErrors['adminEmail']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="register-password" className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  title="Password must be at least 8 characters"
                  className={`input pl-11 pr-11 ${fieldErrors['adminPassword'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                  placeholder="Min. 8 characters"
                  value={formData.adminPassword}
                  onChange={(e) => { setFormData({ ...formData, adminPassword: e.target.value }); if (fieldErrors['adminPassword']) setFieldErrors((prev) => { const next = { ...prev }; delete next['adminPassword']; return next; }); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors['adminPassword'] && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {fieldErrors['adminPassword']}
                </p>
              )}
            </div>
          </div>

          <button type="submit" disabled={registerMutation.isPending} className="w-full btn btn-primary mt-6">
            {registerMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Creating workspace...
              </span>
            ) : 'Create workspace'}
          </button>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have a workspace?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
