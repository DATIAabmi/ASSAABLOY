/**
 * Save a Blob as a file. The link is attached to the page and the object URL
 * is released only after the browser has started the download — revoking it
 * straight after click() cancels the download in some browsers (it arrives as
 * a 0-byte file or not at all).
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
