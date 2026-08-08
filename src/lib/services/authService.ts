import { supabase, isSupabaseConfigured } from '../supabase';
import { Profile, localStore } from '../db';

export const authService = {
  getCurrentUser: async (): Promise<Profile | null> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profileData) {
            localStore.currentUser = profileData;
            return profileData;
          }

          // Construct fallback profile from auth user metadata if trigger hasn't executed
          const authProfile: Profile = {
            id: authData.user.id,
            full_name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Super Admin',
            email: authData.user.email || '',
            role_name: (authData.user.user_metadata?.role_name as any) || 'Super Admin',
            created_at: authData.user.created_at
          };
          localStore.currentUser = authProfile;
          return authProfile;
        }
        return null;
      } catch (e) {
        console.warn('getCurrentUser warning:', e);
        return null;
      }
    }
    return null;
  },

  setCurrentUser: async (user: Profile): Promise<void> => {
    localStore.currentUser = user;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').upsert(user);
      } catch (e) {
        console.warn('setCurrentUser upsert warning:', e);
      }
    }
  },

  getProfiles: async (): Promise<Profile[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('profiles').select('*').order('full_name');
        if (data && data.length > 0) {
          localStore.profiles = data;
          return data;
        }
      } catch (e) {
        console.warn('getProfiles warning:', e);
      }
    }
    return localStore.profiles;
  },

  loginWithEmail: async (emailOrUsername: string, password?: string): Promise<Profile | null> => {
    if (isSupabaseConfigured && supabase && password) {
      let email = emailOrUsername.trim();

      // Resolve username to email if it does not contain '@'
      if (!email.includes('@')) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', email.toLowerCase())
            .maybeSingle();
          if (profileData?.email) {
            email = profileData.email;
          } else {
            throw new Error(`Username "${emailOrUsername}" not found. Please use a registered email or username.`);
          }
        } catch (err: any) {
          throw new Error(err.message || 'Username lookup failed');
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      if (data?.user) {
        let profile: Profile | null = null;
        try {
          const { data: fetchedProfile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          profile = fetchedProfile;
        } catch (e) {
          console.warn('Profile query warning:', e);
        }

        if (!profile) {
          profile = {
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Super Admin',
            email: data.user.email || email,
            role_name: (data.user.user_metadata?.role_name as any) || 'Super Admin',
            created_at: data.user.created_at
          };
          try {
            await supabase.from('profiles').upsert(profile);
          } catch (e) {
            console.warn('Profile upsert warning:', e);
          }
        }
        localStore.currentUser = profile;
        return profile;
      }
    }

    // Fallback profile lookup for local development
    const profiles = localStore.profiles;
    const found = profiles.find(p => p.email.toLowerCase() === emailOrUsername.toLowerCase() || (p.username && p.username.toLowerCase() === emailOrUsername.toLowerCase()));
    if (found) {
      localStore.currentUser = found;
      return found;
    }
    return null;
  },

  logout: async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('SignOut warning:', e);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('billing_hub_current_user');
    }
  }
};
