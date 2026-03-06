'use client';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import InputField from '../components/auth/InputField';
import PasswordInput from '../components/auth/PasswordInput';
import { authServiceApiClient } from '../lib/api/auth-service-api';
import { useAuth } from '@/components/auth/auth-provider';

export const dynamic = 'force-dynamic';

interface FormData {
  username: string;
  password: string;
}

const SupportAuthPage: React.FC = () => {
  const router = useRouter();
  const { login: authLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setMessage(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.username) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      console.log('[Support Login] Starting login process for:', formData.username);
      
      const response = await authServiceApiClient.supportLogin({
        username: formData.username,
        password: formData.password
      });
      
      if (!response || !response.token || !response.user) {
        throw new Error('Invalid response from server');
      }

      console.log('[Support Login] Login successful, storing tokens');
      console.log('[Support Login] Support member:', response.user.username);
      
      // Transform API user to auth user format
      const authUser = {
        id: response.user.id.toString(),
        email: response.user.email,
        username: response.user.username || '',
        firstName: '',
        lastName: '',
        role: 'SUPPORT' as const,
        isVerified: true,
        twoFactorEnabled: false,
        createdAt: response.user.created_at,
        updatedAt: response.user.updated_at
      };
      
      // Use AuthProvider's login method
      authLogin(response.token, authUser);
      
      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      
      // Redirect to support dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (error: any) {
      console.error('[Support Login] Error:', error);
      const errorMsg = error.response?.data?.message || error.message || 
        'Login failed. Please check your credentials.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black grid grid-cols-[1fr_min-content_1fr] font-['Inter']">
      <div className="bg-black relative overflow-hidden flex items-center justify-center pl-30">
        <div className="relative z-10 text-center text-white max-w-md">
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
          <p className="text-xl text-white/80 mb-4 font-medium">
            Customer Support & Ticketing
          </p>
          <p className="text-xs text-white/70 mb-0 leading-relaxed">
            Secure access to customer support management and ticket handling system.
          </p>
        </div>
      </div>
      <div className="w-[2px] h-full bg-gradient-to-b from-black via-yellow-500 to-black"></div>
      <div className="flex items-center justify-center pr-20">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Support Login
            </h2>
            <p className="text-white/80">
              Sign in to access the support dashboard
            </p>
          </div>
          {message && (
            <div
              className={`p-4 mb-6 rounded-xl text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-200 border border-green-400/50'
                  : 'bg-red-500/20 text-red-200 border border-red-400/50'
              }`}
            >
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
              onChange={handleInputChange}
              placeholder="Enter your username"
              error={errors.username}
              Icon={User}
            />
            <PasswordInput
              id="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              error={errors.password}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-yellow-400 disabled:to-yellow-500 text-white font-semibold py-3 px-6 rounded-lg text-sm transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportAuthPage;