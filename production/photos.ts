import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PhotoBucket } from "../worker/home-photos";

export class PrivatePhotos implements PhotoBucket {
  constructor(private readonly client: SupabaseClient, private readonly bucket: string) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket)) throw new Error("Invalid private bucket name");
  }
  async assertPrivate() {
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data || data.public !== false) throw new Error("Private photo storage is unavailable");
  }
  private async object(key: string) {
    if (!/^home-photos\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(key)) throw new Error("Invalid photo object key");
    await this.assertPrivate();
    return this.client.storage.from(this.bucket);
  }
  async put(key: string, value: Uint8Array) {
    const storage = await this.object(key);
    const { error } = await storage.upload(key, value, { contentType: "image/jpeg", cacheControl: "0", upsert: true });
    if (error) throw new Error("Private photo upload failed");
  }
  async get(key: string) {
    const { data, error } = await (await this.object(key)).download(key);
    if (error) {
      if ("statusCode" in error && String(error.statusCode) === "404") return null;
      throw new Error("Private photo retrieval failed");
    }
    return data ? { body: data.stream() } : null;
  }
  async delete(key: string) {
    const { error } = await (await this.object(key)).remove([key]);
    if (error) throw new Error("Private photo removal failed");
  }
}

export function privatePhotos(url: string, serviceKey: string, bucket: string) {
  return new PrivatePhotos(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }), bucket);
}
