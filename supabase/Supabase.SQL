-- =============================================
-- FrameFix Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM Types
-- =============================================

CREATE TYPE image_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =============================================
-- Tables
-- =============================================

-- Batches table: stores print batch information
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Images table: stores image information for each batch
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    original_url TEXT,
    processed_url TEXT,
    status image_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Indexes for better query performance
-- =============================================

CREATE INDEX idx_batches_user_id ON batches(user_id);
CREATE INDEX idx_batches_created_at ON batches(created_at DESC);
CREATE INDEX idx_images_batch_id ON images(batch_id);
CREATE INDEX idx_images_status ON images(status);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS on tables
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Policies for batches table
CREATE POLICY "Users can view their own batches"
    ON batches FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batches"
    ON batches FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches"
    ON batches FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batches"
    ON batches FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for images table
CREATE POLICY "Users can view images from their batches"
    ON images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM batches
            WHERE batches.id = images.batch_id
            AND batches.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert images to their batches"
    ON images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM batches
            WHERE batches.id = images.batch_id
            AND batches.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update images from their batches"
    ON images FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM batches
            WHERE batches.id = images.batch_id
            AND batches.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete images from their batches"
    ON images FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM batches
            WHERE batches.id = images.batch_id
            AND batches.user_id = auth.uid()
        )
    );

-- =============================================
-- Storage bucket for images (run in Supabase Dashboard)
-- =============================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('images', 'images', true);

-- CREATE POLICY "Users can upload images"
--     ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

-- CREATE POLICY "Anyone can view images"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'images');

-- CREATE POLICY "Users can delete their own images"
--     ON storage.objects FOR DELETE
--     USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
