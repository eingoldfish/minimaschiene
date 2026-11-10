/**
 * Share a program as a link: the program text is compressed and put into
 * the URL fragment ("#code=…"). The part after "#" is never sent to the
 * server – the whole program travels only inside the link itself.
 *
 * Format of the fragment:  code=<kind><data>[&ext=1]
 *   kind "z": deflate-compressed UTF-8, base64url
 *   kind "p": plain UTF-8, base64url (fallback if the browser cannot compress)
 */

export interface SharedProgram {
  source: string;
  /** Program needs the extended mode. */
  extended: boolean;
}

// ---------- base64url (like base64, but safe in URLs: - and _ instead of + and /, no =) ----------

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ---------- compression (built into modern browsers: CompressionStream) ----------

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Builds the fragment (without "#") for a program. */
export async function encodeShare(program: SharedProgram): Promise<string> {
  const bytes = new TextEncoder().encode(program.source);
  const data = canCompress()
    ? 'z' + toBase64Url(await transform(bytes, new CompressionStream('deflate-raw')))
    : 'p' + toBase64Url(bytes);
  return `code=${data}${program.extended ? '&ext=1' : ''}`;
}

/**
 * Reads a program from a fragment like "#code=…".
 * Returns null if the fragment contains no program, throws if it is damaged.
 */
export async function decodeShare(fragment: string): Promise<SharedProgram | null> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const code = params.get('code');
  if (!code) return null;
  const kind = code[0];
  const bytes = fromBase64Url(code.slice(1));
  let decoded: Uint8Array;
  if (kind === 'z') {
    if (!canCompress()) throw new Error('Dieser Browser kann den Link nicht entpacken.');
    decoded = await transform(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind === 'p') {
    decoded = bytes;
  } else {
    throw new Error('Unbekanntes Link-Format.');
  }
  return {
    source: new TextDecoder('utf-8', { fatal: true }).decode(decoded),
    extended: params.get('ext') === '1',
  };
}
