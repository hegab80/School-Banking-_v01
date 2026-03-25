import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle } from '../firebase';
import { LogIn } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        <div className="flex flex-col items-center">
          <Logo className="w-48 h-auto mb-4" />
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your school banking account
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={loginWithGoogle}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <LogIn className="h-5 w-5 text-teal-500 group-hover:text-teal-400" aria-hidden="true" />
            </span>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
