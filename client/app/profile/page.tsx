'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Lock, Save, Settings, LogOut, Home, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/loading-screen';

interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  email?: string;
  roleId: string;
  createdAt: string;
  lastLogin?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Loading profile...',
    progress: 0,
    total: 2
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoadingStatus({ message: 'Fetching user data...', progress: 1, total: 2 });
      
      const profileRes = await fetch('/api/profile');
      if (!profileRes.ok) {
        if (profileRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }
      
      const profileData = await profileRes.json();
      setProfile(profileData);
      setFormData({
        username: profileData.username,
        firstName: profileData.firstName,
        email: profileData.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setLoadingStatus({ message: 'Loading role information...', progress: 2, total: 2 });
      
      // Fetch role details
      const rolesRes = await fetch('/api/roles');
      if (rolesRes.ok) {
        const roles = await rolesRes.json();
        const userRole = roles.find((r: Role) => r.id === profileData.roleId);
        setRole(userRole);
      }
      
      setTimeout(() => setLoading(false), 300);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.username) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required to set new password';
      }
      
      if (formData.newPassword.length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters';
      }
      
      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    
    try {
      // Check username availability if changed
      if (formData.username !== profile?.username) {
        const checkRes = await fetch('/api/profile/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: formData.username })
        });
        
        const checkData = await checkRes.json();
        if (!checkData.available) {
          setErrors({ username: 'Username is already taken' });
          setSaving(false);
          return;
        }
      }
      
      // Update profile
      const updateData: any = {
        username: formData.username,
        firstName: formData.firstName,
        email: formData.email
      };
      
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }
      
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error) {
          setErrors({ general: data.error });
        } else {
          setErrors({ general: 'Failed to update profile' });
        }
      } else {
        setSuccessMessage('Profile updated successfully!');
        setProfile(data);
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
        
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setErrors({ general: 'An error occurred while updating profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen
        title="Loading Profile"
        message={loadingStatus.message}
        progress={loadingStatus.progress}
        total={loadingStatus.total}
        icon={User}
      />
    );
  }

  if (!profile) {
    return <div className="p-8 text-red-500">Failed to load profile</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Profile</h1>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-4 py-2 bg-secondary hover:bg-muted text-white rounded-lg transition-colors"
                title="Home"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <Link
                href="/settings"
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-25 p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-1">{profile.firstName}</h2>
                <p className="text-muted-foreground mb-4">@{profile.username}</p>
                
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center space-x-2 text-sm">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium">{role?.name || profile.roleId}</span>
                  </div>
                  
                  {profile.email && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{profile.email}</span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-border text-xs text-muted-foreground">
                    <p>Member since: {new Date(profile.createdAt).toLocaleDateString()}</p>
                    {profile.lastLogin && (
                      <p>Last login: {new Date(profile.lastLogin).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Edit Form */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-25 p-6">
              <h3 className="text-lg font-semibold mb-6">Edit Profile</h3>
              
              {successMessage && (
                <div className="mb-4 p-3 bg-green-500/10 text-green-500 rounded-lg">
                  {successMessage}
                </div>
              )}
              
              {errors.general && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-lg">
                  {errors.general}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className={`w-full pl-10 pr-3 py-2 bg-input border ${
                        errors.username ? 'border-red-500' : 'border-border'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                      placeholder="Enter username"
                    />
                  </div>
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-500">{errors.username}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-3 py-2 bg-input border ${
                      errors.firstName ? 'border-red-500' : 'border-border'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Email (Optional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-10 pr-3 py-2 bg-input border ${
                        errors.email ? 'border-red-500' : 'border-border'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                      placeholder="Enter email address"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                  )}
                </div>
                
                <div className="pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold mb-4">Change Password</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Leave empty to keep current password
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Current Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className={`w-full pl-10 pr-3 py-2 bg-input border ${
                            errors.currentPassword ? 'border-red-500' : 'border-border'
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                          placeholder="Enter current password"
                        />
                      </div>
                      {errors.currentPassword && (
                        <p className="mt-1 text-sm text-red-500">{errors.currentPassword}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className={`w-full pl-10 pr-3 py-2 bg-input border ${
                            errors.newPassword ? 'border-red-500' : 'border-border'
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                          placeholder="Enter new password"
                        />
                      </div>
                      {errors.newPassword && (
                        <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className={`w-full pl-10 pr-3 py-2 bg-input border ${
                            errors.confirmPassword ? 'border-red-500' : 'border-border'
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                          placeholder="Confirm new password"
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}