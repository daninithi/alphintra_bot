'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileCard from '@/components/ui/profile/profileCard';
import { ChangePasswordModal } from '@/components/ui/profile/ChangePasswordModal';
import { useAuth } from '@/components/auth/auth-provider';
import { authServiceApiClient } from '@/lib/api/auth-service-api';

interface SupportUser {
  id: string;
  email: string;
  username: string;
  role: 'SUPPORT';
  createdAt?: string;
  updatedAt?: string;
}

export default function SupportProfile() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState<SupportUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [username, setUsername] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  useEffect(() => {
    if (authUser) {
      const supportUser: SupportUser = {
        id: authUser.id,
        email: authUser.email,
        username: authUser.username || '',
        role: 'SUPPORT',
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt
      };
      setUser(supportUser);
      setUsername(supportUser.username);
    }
  }, [authUser]);

  const profileName = user ? user.username : 'Admin User';

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdateError('');
    setUpdateSuccess('');

    try {
      // Call backend API to update username
      const response = await authServiceApiClient.updateUsername({
        username
      });

      // Update local state
      const updatedUser = {
        ...user,
        username,
      };
      setUser(updatedUser);
      
      // Update localStorage
      const storedUser = localStorage.getItem('alphintra_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        localStorage.setItem('alphintra_user', JSON.stringify({
          ...parsed,
          username
        }));
      }
      
      setIsEditingProfile(false);
      setUpdateSuccess('Profile updated successfully!');
      setTimeout(() => setUpdateSuccess(''), 3000);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update profile. Please try again.';
      setUpdateError(errorMsg);
    }
  };

  const handleCancelEdit = () => {
    setUsername(user?.username || '');
    setIsEditingProfile(false);
    setUpdateError('');
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await authServiceApiClient.changePassword({
      currentPassword,
      newPassword
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ProfileCard avatarUrl={null} nickname={profileName} />
      <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-sm">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Profile Information</h2>
            {!isEditingProfile && (
              <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                Edit Profile
              </button>
            )}
          </div>
          {updateSuccess && (
            <div className="p-4 bg-green-500/20 text-green-200 border border-green-400/50 rounded-xl text-sm font-medium">
              {updateSuccess}
            </div>
          )}
          {updateError && (
            <div className="p-4 bg-red-500/20 text-red-200 border border-red-400/50 rounded-xl text-sm font-medium">
              {updateError}
            </div>
          )}
          {isEditingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-foreground" placeholder="Enter username" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
                <button onClick={handleUpdateProfile} className="px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">Save Changes</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Email</dt><dd className="text-base text-foreground">{user.email}</dd></div>
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Username</dt><dd className="text-base text-foreground">{user.username}</dd></div>
              <div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Role</dt><dd className="text-base text-foreground"><span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">{user.role}</span></dd></div>
              {user.createdAt && (<div className="space-y-1"><dt className="text-sm font-medium text-muted-foreground">Member Since</dt><dd className="text-base text-foreground">{new Date(user.createdAt).toLocaleDateString()}</dd></div>)}
            </div>
          )}
        </section>
        <section className="mt-8 pt-6 border-t border-border space-y-4">
          <h2 className="text-xl font-bold text-foreground">Security</h2>
          <div className="rounded-lg border border-border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Change Password</h3>
                <p className="text-sm text-muted-foreground">Update your password to keep your account secure</p>
              </div>
              <button onClick={() => setShowChangePassword(true)} className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors">Change Password</button>
            </div>
          </div>
        </section>
      </div>
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />
    </div>
  );
}
