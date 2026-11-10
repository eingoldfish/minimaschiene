/**
 * Open and save program files.
 *
 * Chrome and Edge offer the "File System Access API": a real "Open/Save"
 * dialog, and the app may save to the same file again. Firefox and Safari
 * do not have it; there we fall back to a normal file upload (<input type=file>)
 * and a download.
 */

/** File extension of Minimaschine assembler files (assumption, see docs/kompatibilitaet.md point 9). */
export const FILE_EXTENSION = '.mia';
const ACCEPT = [FILE_EXTENSION, '.txt', '.asm'];

// Minimal type declarations: the API is not yet part of TypeScript's DOM types.
interface FileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface FsAccessWindow {
  showOpenFilePicker?(options: { types: PickerType[]; multiple?: boolean }): Promise<FileHandle[]>;
  showSaveFilePicker?(options: { types: PickerType[]; suggestedName: string }): Promise<FileHandle>;
}

const PICKER_TYPES: PickerType[] = [{ description: 'Minimaschine-Programm', accept: { 'text/plain': ACCEPT } }];
const fsWindow = () => window as unknown as FsAccessWindow;

/** Opaque handle for saving to the same file again (only with the File System Access API). */
export type SaveTarget = FileHandle;

export interface OpenedFile {
  name: string;
  text: string;
  target?: SaveTarget;
}

/** True if the user closed the dialog without choosing (not an error). */
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Lets the user pick a file. Returns null if the dialog was cancelled. */
export async function openFile(): Promise<OpenedFile | null> {
  const picker = fsWindow().showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker.call(window, { types: PICKER_TYPES });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: handle.name, text: await file.text(), target: handle };
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }

  // Fallback: classic file upload
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [...ACCEPT, 'text/plain'].join(',');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Saves the text. With a target from an earlier open/save, it is written
 * directly into that file; otherwise a save dialog (or a download) is used.
 * Returns the file name and target, or null if the user cancelled.
 */
export async function saveFile(
  text: string,
  suggestedName: string,
  target?: SaveTarget,
): Promise<{ name: string; target?: SaveTarget; downloaded: boolean } | null> {
  const name = suggestedName.toLowerCase().endsWith(FILE_EXTENSION) ? suggestedName : suggestedName + FILE_EXTENSION;
  const picker = fsWindow().showSaveFilePicker;
  if (target || picker) {
    try {
      const handle = target ?? (await picker!.call(window, { types: PICKER_TYPES, suggestedName: name }));
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { name: handle.name, target: handle, downloaded: false };
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }

  // Fallback: download (ends up in the browser's download folder)
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name, downloaded: true };
}
