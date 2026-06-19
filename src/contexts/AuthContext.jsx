import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/firebase';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create user profile in Supabase 'users' table
  const createUserProfile = async (user, additionalData = {}) => {
    if (!user) return;

    const userId = user.id;

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows returned (profile doesn't exist yet)
      console.error('Error checking user profile:', fetchError);
    }

    if (!existingProfile) {
      const { displayName, email } = user;
      const { email: userEmail } = user;
      const today = new Date().toISOString().slice(0, 10);

      try {
        const { error: insertError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            userId: userId,
            displayName: displayName || user.user_metadata?.display_name || null,
            email: email || userEmail,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),

            // Profile & Gamification
            profile: {
              level: 1,
              xp: 0,
              streakDays: 0,
              lastActiveDate: null,
              lastStreakDate: null
            },

            // Goals
            goals: {
              water: { target: 3000, unit: 'ml' },
              calories: { target: 2000, unit: 'kcal' },
              focus: { target: 60, unit: 'minutes' },
              workout: { target: 1, unit: 'sessions' }
            },

            // Today's Progress
            today: {
              date: today,
              lastReset: null,
              progress: {
                water: 0,
                calories: 0,
                focus: 0,
                mentalHealth: 0
              },
              goalsCompleted: {
                water: false,
                calories: false,
                focus: false,
                workout: false,
                allGoalsMet: false
              }
            },

            // Activities
            activities: {
              water: [],
              meals: [],
              workouts: [],
              focus: [],
              mentalHealth: []
            },

            // Tasks
            tasks: {
              focus: []
            },

            // Custom Content
            custom: {
              workouts: [],
              journal: []
            },

            // Historical Data
            history: {},

            // Metadata
            metadata: {
              schemaVersion: '2.0',
              lastMigration: new Date().toISOString(),
              dataRetentionDays: 365
            },

            // Calendar for streak tracking
            calendar: [],

            // Additional data from signup
            ...additionalData
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
        } else {
          console.log('[AuthContext] Created new user profile with NEW SCHEMA for:', userId);
        }
      } catch (error) {
        console.error('Error creating user profile:', error);
      }
    }

    return;
  };

  const signup = async (email, password, displayName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Update user metadata with display name
        if (displayName) {
          await supabase.auth.updateUser({
            data: { display_name: displayName }
          });
        }

        // Create user profile in Supabase
        await createUserProfile(data.user, { displayName });
      }

      return data;
    } catch (error) {
      // Handle signup errors appropriately
      if (error.message?.includes('already registered') || error.code === 'user_already_exists') {
        throw new Error('An account with this email already exists. Please sign in instead.');
      } else if (error.message?.includes('weak password') || error.code === 'weak_password') {
        throw new Error('Password is too weak. Please use at least 6 characters.');
      } else if (error.message?.includes('invalid email') || error.code === 'invalid_email') {
        throw new Error('Invalid email address.');
      }
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Ensure user profile exists in Supabase (create if missing)
      if (data.user) {
        await createUserProfile(data.user);
      }

      return data;
    } catch (error) {
      // Handle login errors
      if (error.message?.includes('Invalid login credentials') || error.code === 'invalid_credentials') {
        throw new Error('Invalid email or password. Please try again.');
      } else if (error.message?.includes('Email not confirmed')) {
        throw new Error('Please confirm your email address before signing in.');
      } else if (error.message?.includes('invalid email')) {
        throw new Error('Invalid email address.');
      }
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const googleSignIn = async () => {
    try {
      console.log('Attempting Google sign in...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;

      // For OAuth, the page will redirect. We don't need to create a profile here
      // because onAuthStateChange will handle it when the user returns
      console.log('Google sign in redirect initiated');

      return data;
    } catch (error) {
      console.error('Detailed Google sign in error:', {
        message: error.message,
        status: error.status
      });
      throw error;
    }
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;

        if (user) {
          // Ensure user profile exists in Supabase
          await createUserProfile(user);
        }

        setCurrentUser(user);
        setLoading(false);
      }
    );

    // Check for existing session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    googleSignIn
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
