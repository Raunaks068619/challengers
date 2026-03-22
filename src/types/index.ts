export interface Waypoint {
    lat: number;
    lng: number;
    timestamp: number;
    accuracy?: number;
    altitude?: number | null;
}

export interface Challenge {
    id?: string;
    title: string;
    description: string;
    creator_id?: string | null;
    start_date: string;
    end_date: string;
    time_window_start: string | null;
    time_window_end: string | null;
    status: "active" | "completed" | "cancelled";
    created_at?: string;
    participants?: string[];
    // Gamification & Location
    requires_location: boolean;
    location_lat?: number | null;
    location_lng?: number | null;
    location_radius?: number; // in meters
    locations?: { lat: number; lng: number; radius: number; address?: string }[];
    join_code?: string;
    banner_url?: string | null;
    rest_days?: number[]; // 0=Sunday, 1=Monday, etc.
    // Activity tracking (Strava-style route challenges)
    activity_tracking?: boolean;
    activity_type?: "run" | "walk" | "cycle" | "any";
    min_distance_m?: number;   // minimum metres required to count as a valid check-in
    min_duration_s?: number;   // minimum seconds required to count as a valid check-in
}

export interface DailyLog {
    id?: string;
    challenge_id: string;
    user_id: string;
    date: string;
    status: "completed" | "missed";
    created_at: string;
    proof_url?: string;
    lat?: number | null;
    lng?: number | null;
    verified: boolean;
    location_verified?: boolean;
    distance_from_fence_m?: number;
    matched_fence?: string;
    note?: string;
    // Activity tracking data (populated when challenge.activity_tracking === true)
    route?: Waypoint[];
    distance_m?: number;
    duration_s?: number;
    avg_pace_s_per_km?: number | null;
    activity_type?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    photo_url: string | null;
    first_name?: string;
    last_name?: string;
    contact_email?: string;
    contact_phone?: string;
    bio?: string;
    // Gamification
    total_earned: number;
    total_lost: number;
    current_points: number;
    fcm_token?: string | null;
    install_prompt_seen?: boolean;
    points_history?: { date: string; points: number; taskStatus?: 'completed' | 'missed' }[];
    theme?: 'light' | 'dark' | 'system';
}

export interface ChallengeParticipant {
    challenge_id: string;
    user_id: string;
    current_points: number;
    streak_current: number;
    streak_best: number;
    is_active: boolean;
    points_history?: { date: string; points: number; taskStatus?: 'completed' | 'missed' }[];
}
