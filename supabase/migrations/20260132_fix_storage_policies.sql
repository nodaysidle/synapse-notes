-- Allow authenticated users to upload to audio bucket
CREATE POLICY "Allow authenticated uploads to audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio');

-- Allow public read access to audio
CREATE POLICY "Allow public read audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audio');

-- Allow authenticated users to upload to images bucket  
CREATE POLICY "Allow authenticated uploads to images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Allow public read access to images
CREATE POLICY "Allow public read images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');
