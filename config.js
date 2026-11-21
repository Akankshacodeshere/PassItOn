// Paste your Supabase details here (Supabase > Project Settings > API).
// While the placeholders below are untouched, the site runs in PROTOTYPE MODE
// (data saved only in your own browser) so you can try everything instantly.
window.CFG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_KEY: "YOUR-ANON-PUBLIC-KEY", // anon key is meant to be public. NEVER paste the service_role key.
  DOMAIN: "bennett.edu.in",             // only emails ending with this can log in
  ADMIN: "your-email@bennett.edu.in",   // shown on the site for help/complaints
  // PROTOTYPE MODE ONLY: log in with one of these emails to see the moderator "Review queue".
  // In the real site, moderators are added in Supabase (see SETUP.md, step A6).
  MODERATORS: ["admin@bennett.edu.in"]
};
