CREATE POLICY "Signed-in users can read khasra data"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'khasra-data');