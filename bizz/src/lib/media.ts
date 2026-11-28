import { env } from '@/lib/env';

export type PublicBucket = 'post-media' | 'avatars';

/** Public CDN URL of a file stored in a public bucket. */
export function publicUrl(bucket: PublicBucket, path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
