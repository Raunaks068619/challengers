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
    location_radius?: number | null;
}

export interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    photo_url: string | null;
    // Gamification
    total_earned: number;
    total_lost: number;
    current_points: number;
    fcm_token?: string | null;
}

export interface ChallengeParticipant {
    challenge_id: string;
    user_id: string;
    current_points: number;
    streak_current: number;
    streak_best: number;
    is_active: boolean;
}
