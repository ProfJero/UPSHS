export type PublishStatus = 'draft' | 'review' | 'published' | 'archived';

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  category?: { name: string; slug: string } | null;
  author?: { full_name: string | null } | null;
}

export interface SchoolEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  status: PublishStatus;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  priority: 'normal' | 'important' | 'urgent';
  published_at: string | null;
  expires_at: string | null;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  items?: { id: string; image_url: string; caption: string | null; alt_text?: string | null; display_order?: number }[];
}
