import { create } from 'zustand';

export interface LightboxImage {
  url: string;
  name?: string;
}

interface LightboxState {
  images: LightboxImage[];
  index: number;
  open: boolean;
  show: (images: LightboxImage[], index: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
}

/** Global image lightbox (decision 0031). Any chat image opens it; it can swipe
 *  between the images of the message it came from. */
export const useLightbox = create<LightboxState>((set) => ({
  images: [],
  index: 0,
  open: false,
  show: (images, index) => set({ images, index, open: images.length > 0 }),
  close: () => set({ open: false }),
  next: () => set((s) => ({ index: Math.min(s.images.length - 1, s.index + 1) })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
}));
