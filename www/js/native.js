// Bridges to the phone (share sheet / saving files). Falls back to a normal
// browser download when running outside the Android app.

export const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function plugin(name) {
  const C = window.Capacitor;
  return (C.Plugins && C.Plugins[name]) || C.registerPlugin(name);
}

const textToBase64 = t => btoa(unescape(encodeURIComponent(t)));

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Hand a file to the user: Android share sheet (save to Files/Photos, print,
// send...) in the app, or a download in the browser.
export async function deliverFile({ filename, mime, text, base64, title }) {
  const data = base64 ?? textToBase64(text);
  if (isNative()) {
    const written = await plugin('Filesystem').writeFile({ path: filename, data, directory: 'CACHE' });
    await plugin('Share').share({ title, dialogTitle: title, url: written.uri });
    return 'shared';
  }
  const url = URL.createObjectURL(base64ToBlob(data, mime));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
