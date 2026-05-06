export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Link {
  id: string;
  user_id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export interface PageView {
  id: string;
  profile_id: string;
  viewed_at: string;
  referrer: string | null;
}
