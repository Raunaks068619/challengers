export interface Challenge {
    id?: string;
    title: string;
    description: string;
    creator_id?: string | null; // Renamed from manager_id
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
    locations?: { lat: number; lng: number; radius: number; address?: string }[]; // Multiple locations support
    join_code?: string;
    banner_url?: string | null;
    rest_days?: number[]; // 0=Sunday, 1=Monday, etc.
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
