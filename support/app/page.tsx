'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import InputField from '@/components/auth/InputField';
import PasswordInput from '@/components/auth/PasswordInput';
import { useAuth } from '@/components/auth/auth-provider';
import { buildGatewayUrl } from '@/lib/config/gateway';
import { setToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface FormData {
  username: string;
  password: string;
}

const SupportLoginPage: React.FC = () => {
  const router = useRouter();
  const { login: authLogin, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<FormData>({ username: '', password: '' });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (isAuthenticated) {
    router.push('/ticketing');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) setErrors(prev => ({ ...prev, [name]: '' }));
    setMessage(null);
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await fetch(buildGatewayUrl('/auth/f/support/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid credentials');
      }
      setToken(data.token);
      authLogin(data.token, {
        id: String(data.user.id),
        username: data.user.username,
        email: data.user.email,
        role: 'SUPPORT',
      });
      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => router.push('/ticketing'), 500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Login failed. Please check your credentials.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black grid grid-cols-[1fr_min-content_1fr] font-sans">
      {/* Left panel */}
      <div className="bg-black flex items-center justify-center pl-20">
        <div className="text-center text-white max-w-md">
          <div className="mb-8">
            <Image
              src="/images/blueLogo.png"
              alt="Alphintra Logo"
              width={192}
              height={192}
              className="w-48 h-48 object-contain mx-auto mb-6 animate-float"
            />
          </div>
          <h1 className="text-5xl font-bold mb-4 text-white">ALPHINTRA</h1>
          <h2 className="text-3xl font-bold mb-4 text-yellow-500">SUPPORT PORTAL</h2>
          <p className="text-xl text-white/80 mb-4 font-medium">Customer Support Center</p>
          <p className="text-xs text-white/60 leading-relaxed">
            Secure access to support ticketing, user management, and customer assistance tools.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="w-[2px] h-full bg-gradient-to-b from-black via-yellow-500 to-black"></div>

      {/* Right panel — login form */}
      <div className="flex items-center justify-center pr-20">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Support Login</h2>
            <p className="text-white/80">Sign in to access the support dashboard</p>
          </div>

          {message && (
            <div className={`p-4 mb-6 rounded-xl text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-500/20 text-green-200 border border-green-400/50'
                : 'bg-red-500/20 text-red-200 border border-red-400/50'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-5">
            <InputField
              id="username"
              label="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              error={errors.username}
              Icon={User}
            />
            <PasswordInput
              id="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              error={errors.password}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-60 text-black font-semibold py-3 px-6 rounded-lg text-sm transition-all duration-200 flex items-center justify-center shadow-lg disabled:cursor-not-allowed"
            >
              {isLoading
                ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportLoginPage;
