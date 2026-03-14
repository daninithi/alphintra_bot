'use client';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, User } from 'lucide-react';
import InputField from '../components/auth/InputField';
import PasswordInput from '../components/auth/PasswordInput';
import { authServiceApiClient } from '../lib/api/auth-service-api';
import { useAuth } from '@/components/auth/auth-provider';
import {
  EMAIL_VERIFICATION_EXPIRY_MS,
  generateVerificationCode,
  sendVerificationEmail,
  SignupFormPayload,
  storePendingSignup,
} from '@/lib/email/verification';

export const dynamic = 'force-dynamic';

interface FormData {
  username?: string;
  email: string;
  password: string;
}

const AdminAuthPage: React.FC = () => {
  const router = useRouter();
  const { login: authLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
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

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!isLogin) {
      if (!formData.username) newErrors.username = 'Username is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isLogin) {
        console.log('[Admin Login] Starting login process for:', formData.email);

        const response = await authServiceApiClient.login({
          email: formData.email,
          password: formData.password,
        });

        if (!response || !response.token || !response.user) {
          throw new Error('Invalid response from server');
        }

        const authUser = {
          id: response.user.id.toString(),
          email: response.user.email,
          username: response.user.username || 'alphintraadmin',
          role: 'ADMIN' as const,
          isVerified: true,
          twoFactorEnabled: false,
          createdAt: response.user.created_at,
          updatedAt: response.user.updated_at,
        };

        authLogin(response.token, authUser);
        
        setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
        
        // Redirect to admin dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        console.log('[Admin Signup] Checking if admin already exists...');
        
        // Check if admin already exists before allowing signup
        const exists = await authServiceApiClient.checkAdminExists();
        
        if (exists) {
          setMessage({
            type: 'error',
            text: 'Admin already exists. Only one admin is allowed in the system. Please use the login form instead.',
          });
          return;
        }
        
        console.log('[Admin Signup] Initiating signup flow for', formData.email);

        const signupPayload: SignupFormPayload = {
          username: formData.username!,
          email: formData.email,
          password: formData.password,
        };

        try {
          const code = generateVerificationCode();
          console.log('[Admin Signup] Generated verification code', code);
          await sendVerificationEmail(
            signupPayload.email,
            code,
            signupPayload.username || signupPayload.email
          );

          storePendingSignup({
            formData: signupPayload,
            email: signupPayload.email,
            code,
            expiresAt: Date.now() + EMAIL_VERIFICATION_EXPIRY_MS,
            name: signupPayload.username || signupPayload.email,
          });

          console.log('[Admin Signup] Pending signup stored, redirecting to verify page');
          setMessage({
            type: 'success',
            text: 'We sent you a verification code. Please check your email.',
          });
          setTimeout(() => {
            window.location.href = '/verify';
          }, 1000);
        } catch (emailError) {
          console.error('[Admin Signup] Failed to send verification email', emailError);
          setMessage({
            type: 'error',
            text: 'We could not send the verification email. Please try again.',
          });
        }
      }
    } catch (error: any) {
      console.error('[Admin Auth] Error:', error);
      const errorMsg = error.response?.data?.message || error.message || 
        (isLogin ? 'Login failed. Please check your credentials.' : 'Sign up failed. Please try again.');
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      password: ''
    });
    setErrors({});
    setMessage(null);
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
          <h2 className="text-3xl font-bold mb-4 text-yellow-500">ADMIN CONSOLE</h2>
          <p className="text-xl text-white/80 mb-4 font-medium">
            Management & Control Center
          </p>
          <p className="text-xs text-white/70 mb-0 leading-relaxed">
            Secure access to platform administration, user management, and system monitoring.
          </p>
        </div>
      </div>
      <div className="w-[2px] h-full bg-gradient-to-b from-black via-yellow-500 to-black"></div>
      <div className="flex items-center justify-center pr-20">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Admin Login' : 'Admin Signup'}
            </h2>
            <p className="text-white/80">
              {isLogin 
                ? 'Sign in to access the admin dashboard' 
                : 'Create your admin account'}
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
            {!isLogin && (
              <InputField
                id="username"
                label="Username"
                type="text"
                name="username"
                value={formData.username || ''}
                onChange={handleInputChange}
                placeholder="Choose a username"
                error={errors.username}
                Icon={User}
              />
            )}
            <InputField
              id="email"
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder={isLogin ? 'Enter your email' : 'your.email@example.com'}
              error={errors.email}
              Icon={Mail}
            />
            <PasswordInput
              id="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder={isLogin ? 'Enter your password' : 'Create a password (min 8 characters)'}
              error={errors.password}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-yellow-400 disabled:to-yellow-500 text-black font-semibold py-3 px-6 rounded-lg text-sm transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
              ) : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-white/60">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthPage;