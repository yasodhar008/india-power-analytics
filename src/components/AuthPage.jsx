import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg('Account created successfully! You can now sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // User will be automatically redirected by AuthContext listener
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
      });
      if (error) throw error;
    } catch (error) {
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-white">
      {/* Left Panel - Dark Green Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f2e24] to-[#0a1914] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Logo Mark (subtle) */}
        <div className="absolute top-[-10%] left-[-10%] opacity-5">
            <svg viewBox="0 0 100 100" className="w-[800px] h-[800px] fill-current">
                <path d="M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z" />
            </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-24">
            <div className="w-10 h-10 bg-[#00c875] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">VTKenergy.com</span>
            <span className="text-xs font-semibold bg-[#00c875]/20 text-[#00c875] px-2 py-0.5 rounded-full ml-1">v2.0</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-5xl font-bold leading-[1.1] mb-6">
              Start building<br />
              better batteries<br />
              today.
            </h1>
            <p className="text-lg text-gray-300 mb-12">
              Create an account to access advanced cell libraries, run cloud-based PyBaMM models, and explore BESS economic opportunities.
            </p>

            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-600 border-2 border-[#0a1914]"></div>
                <div className="w-10 h-10 rounded-full bg-gray-500 border-2 border-[#0a1914]"></div>
                <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-[#0a1914]"></div>
                <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-[#0a1914]"></div>
              </div>
              <span className="text-sm font-medium text-gray-300">
                Join <strong className="text-white bg-blue-600/30 px-1 rounded">2,000+</strong> cell engineers
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white text-gray-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold mb-2 tracking-tight">
              {isSignUp ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="text-gray-500">
              {isSignUp ? 'Sign up to get started with VTKenergy.com' : 'Sign in to your VTKenergy.com account'}
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </button>
            <button
              onClick={() => handleOAuth('github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors font-medium shadow-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 10 0 0 12 2z"/>
              </svg>
              {isSignUp ? 'Sign up with GitHub' : 'Sign in with GitHub'}
            </button>
          </div>

          <div className="relative flex items-center justify-center my-6">
            <div className="absolute border-t border-gray-200 w-full"></div>
            <span className="relative bg-white px-4 text-sm text-gray-400">Or continue with email</span>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c875] focus:border-transparent text-gray-900"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c875] focus:border-transparent text-gray-900"
                placeholder="••••••••"
                required
              />
            </div>

            {errorMsg && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#00a862] hover:bg-[#009154] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-70 shadow-sm"
            >
              {loading ? 'Processing...' : (isSignUp ? 'Create account' : 'Sign in')}
              {!loading && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <span className="text-gray-500 text-sm">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button
                onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                }}
                className="text-[#00c875] font-bold hover:underline"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
