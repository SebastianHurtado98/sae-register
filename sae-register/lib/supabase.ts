import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://pbmkowolmcphfpcurjap.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibWtvd29sbWNwaGZwY3VyamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3OTA0MTcsImV4cCI6MjA0NzM2NjQxN30.dpaSKVqdl1Knk-uAZtpvvAniBeFv_qY1dft1akBHFGk"

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)