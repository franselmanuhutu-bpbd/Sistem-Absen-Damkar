import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

type FileFilter = {
  name: string;
  extensions: string[];
};

function fileFilter(filename: string): FileFilter[] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return [{ name: "PDF", extensions: ["pdf"] }];
  if (extension === "xlsx") return [{ name: "Excel", extensions: ["xlsx"] }];
  if (extension === "zip") return [{ name: "ZIP", extensions: ["zip"] }];
  return [];
}

export async function saveFileForRuntime(
  data: Blob | Uint8Array,
  filename: string,
): Promise<boolean> {
  if (isTauri()) {
    const path = await save({
      defaultPath: filename,
      filters: fileFilter(filename),
    });

    if (!path) return false;

    const bytes = data instanceof Blob
      ? new Uint8Array(await data.arrayBuffer())
      : data;
    await writeFile(path, bytes);
    return true;
  }

  const blob = data instanceof Blob
    ? data
    : new Blob([toArrayBuffer(data)]);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
  return true;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}
