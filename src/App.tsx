import { useEffect, useState } from 'react';
import { seedIfEmpty } from './db/db';
import { AudioSourceProvider } from './audio/context';
import { Library } from './ui/Library';
import './App.css';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) return <p className="loading">Ouverture du crate...</p>;
  return (
    <AudioSourceProvider>
      <Library />
    </AudioSourceProvider>
  );
}
