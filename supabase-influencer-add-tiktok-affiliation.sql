-- Add TikTok + affiliation interest columns to influencer_applications.
-- Run once in Supabase SQL Editor.

alter table influencer_applications
  add column if not exists tiktok text,
  add column if not exists affiliation_interest text
    check (affiliation_interest in ('oui','peut_etre','non'));
