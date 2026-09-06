// Extraction de la pochette d'un MP3.
//
// Les fichiers Bandcamp portent leur pochette dans une frame APIC de leur
// en-tete ID3v2. La lire evite a Selim d'aller chercher 24 images a la main,
// et c'est la pochette qu'il utilise pour reconnaitre un disque.

const ID3 = 0x494433; // "ID3"

/** Les tailles d'ID3v2 sont sur 7 bits par octet, le huitieme est toujours a 0. */
function synchsafe(view: DataView, at: number): number {
  return (
    ((view.getUint8(at) & 0x7f) << 21) |
    ((view.getUint8(at + 1) & 0x7f) << 14) |
    ((view.getUint8(at + 2) & 0x7f) << 7) |
    (view.getUint8(at + 3) & 0x7f)
  );
}

function readUntilNull(bytes: Uint8Array, from: number, wide: boolean): [string, number] {
  let end = from;
  if (wide) {
    while (end + 1 < bytes.length && !(bytes[end] === 0 && bytes[end + 1] === 0)) end += 2;
    const s = new TextDecoder('utf-16').decode(bytes.subarray(from, end));
    return [s, end + 2];
  }
  while (end < bytes.length && bytes[end] !== 0) end += 1;
  const s = new TextDecoder('latin1').decode(bytes.subarray(from, end));
  return [s, end + 1];
}

/**
 * Renvoie la premiere image trouvee, ou null si le fichier n'en porte pas.
 * Ne lit que l'en-tete : inutile de charger un MP3 entier en memoire.
 */
export async function extractCover(file: Blob): Promise<Blob | null> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10) return null;
  if (((head[0] << 16) | (head[1] << 8) | head[2]) !== ID3) return null;

  const major = head[3];
  const headerView = new DataView(head.buffer);
  const tagSize = synchsafe(headerView, 6);
  const bytes = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  const view = new DataView(bytes.buffer);

  let at = 0;
  while (at + 10 <= bytes.length) {
    const id = new TextDecoder('latin1').decode(bytes.subarray(at, at + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // zone de bourrage, fin des frames
    // v2.4 encode les tailles de frame en synchsafe, v2.3 en entier simple.
    const size = major >= 4 ? synchsafe(view, at + 4) : view.getUint32(at + 4);
    const body = at + 10;
    if (size <= 0 || body + size > bytes.length) break;

    if (id === 'APIC') {
      const encoding = bytes[body];
      const [mime, afterMime] = readUntilNull(bytes, body + 1, false);
      const afterType = afterMime + 1; // octet de type d'image
      const [, afterDesc] = readUntilNull(bytes, afterType, encoding === 1 || encoding === 2);
      const data = bytes.subarray(afterDesc, body + size);
      if (data.length > 0) {
        return new Blob([data], { type: mime || 'image/jpeg' });
      }
    }
    at = body + size;
  }
  return null;
}
