const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/;

/** Returns an error message, or null when the base name is usable. */
export function validateFilename(base: string): string | null {
  const name = base.trim();
  if (!name) return "Enter a file name.";
  if (ILLEGAL.test(name)) return 'File names can\'t contain \\ / : * ? " < > |';
  if (name.length > 120) return "Keep the file name under 120 characters.";
  if (/^\.+$/.test(name)) return "Enter a file name.";
  return null;
}

/** Joins a base name and extension, without doubling the extension if the user typed it. */
export function withExtension(base: string, extension: string): string {
  const name = base.trim();
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

export function suggestFilename(from: string, to: string, today: string): string {
  if (!from && !to) return `expenses-${today}`;
  return `expenses-${from || "start"}-to-${to || today}`;
}
