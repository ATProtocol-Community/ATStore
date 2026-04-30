/** Strip the `data:…;base64,` prefix from a FileReader data URL. */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const s = reader.result;
      if (typeof s !== "string") {
        reject(new Error("Could not read image."));
        return;
      }
      const comma = s.indexOf(",");
      resolve(comma === -1 ? s : s.slice(comma + 1));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Could not read image."));
    });
    reader.readAsDataURL(blob);
  });
}
