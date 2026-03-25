import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { LogOut, Home, Users, Mic, User, RefreshCw } from 'lucide-react';
import Logo from './Logo';

export default function Layout() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleRole = async () => {
    if (!profile || !user) return;
    setIsSwitching(true);
    try {
      const newRole = profile.role === 'teacher' ? 'student' : 'teacher';
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
    } catch (error) {
      console.error("Failed to switch role", error);
      alert("Failed to switch role. Only the admin can do this.");
    } finally {
      setIsSwitching(false);
    }
  };

  const isAdmin = user?.email === 'm.hegab.eg@gmail.com';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex flex-col items-center text-center">
          <Logo className="w-32 h-auto mb-2" />
          <p className="text-xs text-gray-500">School Banking App</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors">
            <Home className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </Link>
          
          {profile?.role === 'teacher' && (
            <Link to="/teacher" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors">
              <Users className="w-5 h-5" />
              <span className="font-medium">Teacher Panel</span>
            </Link>
          )}
          
          <Link to="/voice" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors">
            <Mic className="w-5 h-5" />
            <span className="font-medium">Voice Assistant</span>
          </Link>
        </nav>
        
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
              {profile?.full_name?.charAt(0) || <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          
          {isAdmin && (
            <button 
              onClick={toggleRole}
              disabled={isSwitching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSwitching ? 'animate-spin' : ''}`} />
              Switch to {profile?.role === 'teacher' ? 'Student' : 'Teacher'}
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
