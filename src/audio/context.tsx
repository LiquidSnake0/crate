import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AudioSource } from './source';
import { MockAudioSource } from './mock';
import { LocalFileSource } from './local';
import { BandcampLinkSource } from './bandcamp';

interface Ctx {
  source: AudioSource;
  sources: AudioSource[];
  setSourceId: (id: string) => void;
}

const AudioContext = createContext<Ctx | null>(null);

export function AudioSourceProvider({ children }: { children: ReactNode }) {
  const sources = useMemo(
    () => [new MockAudioSource(), new LocalFileSource(), new BandcampLinkSource()],
    [],
  );
  const [id, setSourceId] = useState('mock');
  const source = sources.find((s) => s.id === id) ?? sources[0];
  return (
    <AudioContext.Provider value={{ source, sources, setSourceId }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioSource(): Ctx {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudioSource hors AudioSourceProvider');
  return ctx;
}
