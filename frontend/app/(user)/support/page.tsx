'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import UserSupportDashboard from '@/components/support/user/UserSupportDashboard';
import { Loader2 } from 'lucide-react';

export default function SupportPage() {
  const { user, isLoading } = useAuth();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <UserSupportDashboard
        userId={user?.id || ''}
      />
    </div>
  );
}