import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PrivatePhotos } from "../../production/photos";

function fixture(isPublic = false) {
  const object = { upload: vi.fn(async () => ({ error: null })), download: vi.fn(async () => ({ data: new Blob(["photo"]), error: null })), remove: vi.fn(async () => ({ error: null })) };
  const storage = { getBucket: vi.fn(async () => ({ data: { public: isPublic }, error: null })), from: vi.fn(() => object) };
  return { bucket: new PrivatePhotos({ storage } as unknown as SupabaseClient, "home-photos"), storage, object };
}
const key = "home-photos/request/photo.jpg";
it("checks bucket privacy before every read, write, and removal", async () => {
  const f = fixture(); await f.bucket.put(key, new Uint8Array([1])); await f.bucket.get(key); await f.bucket.delete(key);
  expect(f.storage.getBucket).toHaveBeenCalledTimes(3);
  expect(f.object.upload).toHaveBeenCalledWith(key, expect.any(Uint8Array), { contentType: "image/jpeg", cacheControl: "0", upsert: true });
  expect(f.object.download).toHaveBeenCalledWith(key); expect(f.object.remove).toHaveBeenCalledWith([key]);
});
it("refuses an accidentally public bucket without accessing any object", async () => {
  const f = fixture(true);
  await expect(f.bucket.get(key)).rejects.toThrow("Private photo storage");
  await expect(f.bucket.put(key, new Uint8Array())).rejects.toThrow();
  await expect(f.bucket.delete(key)).rejects.toThrow();
  expect(f.storage.from).not.toHaveBeenCalled();
});
it("rejects traversal, arbitrary URLs and unexpected object prefixes", async () => {
  const f = fixture();
  for (const path of ["../secret", "https://other.test/photo", "home-photos/../photo.jpg", "other/request/photo.jpg"]) await expect(f.bucket.get(path)).rejects.toThrow("Invalid photo");
  expect(f.storage.getBucket).not.toHaveBeenCalled();
});
it("propagates storage outages instead of reporting a missing or saved photo", async () => {
  const f = fixture(); f.object.upload.mockRejectedValue(new Error("offline"));
  await expect(f.bucket.put(key, new Uint8Array())).rejects.toThrow();
  f.object.download.mockRejectedValue(new Error("offline")); await expect(f.bucket.get(key)).rejects.toThrow();
});
