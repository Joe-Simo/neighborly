/**
 * Hands the reader a file to save. The address is let go a minute later, not at once: Safari on iPhone and iPad
 * starts the download only after the click has returned, and an address let go before that gives no file at all.
 */
export function saveFile(file: Blob, name: string) {
  const address = URL.createObjectURL(file);
  Object.assign(document.createElement("a"), { href: address, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(address), 60_000);
}
