// api/keep-alive.js
export default async function handler(req, res) {
    // Your Supabase details
    const SUPABASE_URL = 'https://othustwbygpxcynfnhuc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aHVzdHdieWdweGN5bmZuaHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDY0OTgsImV4cCI6MjEwNTY4MjQ5OH0.NUoWMeLuqUp94zTcWhZzNDt1AtGI8BEeWyUuL_vk7D8';

    try {
        // We just do a lightweight fetch on the tutors table. 
        // It counts as activity, but doesn't change any data.
        const response = await fetch(`${SUPABASE_URL}/rest/v1/tutors?select=id&limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error('Supabase ping failed');

        return res.status(200).json({ status: 'success', message: 'Supabase is awake!' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}
