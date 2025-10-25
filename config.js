// REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://svrzvfyochvbzqdbubeo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cnp2ZnlvY2h2YnpxZGJ1YmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzE2MTgsImV4cCI6MjA3NjkwNzYxOH0.LpS8nJaeOn0T0hcy83fS-suLa2GVf_2RAWlOY3Cycl0';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
