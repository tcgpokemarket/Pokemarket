import { createClient } from "@/lib/supabase/server";
type FollowRow = {
  following_id: string;
  created_at: string;
};

type FriendshipRow = {
  requester_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  created_at: string;
};

type PrivacySettingsRow = {
  user_id: string;
  profile_visibility?: string | null;
  allow_messages?: boolean | null;
};

export async function getProfileByUsername(username: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_seller, seller_rating, total_sales, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getSocialCounts(userId: string) {
  const supabase = await createClient();
  const [{ count: followers }, { count: following }, { count: friends }] = await Promise.all([
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
    supabase.from("friendships").select("id", { count: "exact", head: true }).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted"),
  ]);

  return {
    followers: followers ?? 0,
    following: following ?? 0,
    friends: friends ?? 0,
  };
}

export async function getPrivacySettings(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_privacy_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getUserFeed(userId: string) {
  const supabase = await createClient();
  const [{ data: follows }, { data: notifications }, { data: friends }] = await Promise.all([
    supabase.from("follows").select("following_id, created_at").eq("follower_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("friendships").select("requester_id, receiver_id, status, created_at").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).limit(100),
  ]);

  return {
    follows: (follows ?? []) as FollowRow[],
    notifications: (notifications ?? []) as NotificationRow[],
    friends: (friends ?? []) as FriendshipRow[],
  };
}
