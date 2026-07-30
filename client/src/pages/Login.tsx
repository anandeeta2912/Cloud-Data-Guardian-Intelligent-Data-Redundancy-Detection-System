import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Database, Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import Spinner from '../components/ui/Spinner';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '', tenantSlug: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const loginMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/auth/login', data).then((r) => r.data),
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
    if (!formData.tenantSlug.trim()) errors.tenantSlug = 'Workspace slug is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Please enter a valid email address.';
    if (!formData.password) errors.password = 'Password is required.';
    else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px] animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] animate-float" style={{ animationDelay: '3s' }}></div>
      
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8 animate-slide-up">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6">
            <Database className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to your workspace to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 shadow-2xl animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          {loginMutation.isError && !loginMutation.error?.response?.data?.error?.data?.errors && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-scale-in">
              {(loginMutation.error as any)?.response?.data?.error?.message || 'Login failed. Please check your credentials.'}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="login-tenant-slug" className="text-sm font-medium text-slate-300">Workspace Slug</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <input
                  id="login-tenant-slug"
                  type="text"
                  required
                  title="Enter your workspace slug, e.g. acme-corp"
                  className={`input pl-11 ${fieldErrors['tenantSlug'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                  placeholder="acme-corp"
                  value={formData.tenantSlug}
                  onChange={(e) => { setFormData({ ...formData, tenantSlug: e.target.value }); if (fieldErrors['tenantSlug']) setFieldErrors((prev) => { const next = { ...prev }; delete next['tenantSlug']; return next; }); }}
                />
              </div>
              {fieldErrors['tenantSlug'] && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {fieldErrors['tenantSlug']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  title="Enter your email address"
                  className={`input pl-11 ${fieldErrors['email'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                  placeholder="jane@acme.com"
                  value={formData.email}
                  onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (fieldErrors['email']) setFieldErrors((prev) => { const next = { ...prev }; delete next['email']; return next; }); }}
                />
              </div>
              {fieldErrors['email'] && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {fieldErrors['email']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  title="Password must be at least 8 characters"
                  className={`input pl-11 pr-11 ${fieldErrors['password'] ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20' : ''}`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); if (fieldErrors['password']) setFieldErrors((prev) => { const next = { ...prev }; delete next['password']; return next; }); }}
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
              {fieldErrors['password'] && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {fieldErrors['password']}
                </p>
              )}
            </div>
          </div>

          <button type="submit" disabled={loginMutation.isPending} className="w-full btn btn-primary mt-6">
            {loginMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>

          <p className="text-center text-sm text-slate-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create workspace
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
