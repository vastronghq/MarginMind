import { getPref } from "../utils/prefs";
import JSZip from "jszip";
import { unzipSync, strFromU8 } from "fflate";

const BASE_URL = "https://mineru.net/api/v4";

interface BatchResponse {
  code: number;
  data: {
    batch_id: string;
    file_urls: string[];
  };
}

interface ExtractResultsResponse {
  data: {
    extract_result: Array<{
      state: string;
      full_zip_url: string | null;
    }>;
  };
}

/**
 * 获取 MinerU API Key
 */
export function getMinerUApiKey(): string {
  return (getPref("mineruApiKey") as string) || "";
}

/**
 * 上传 PDF 到 MinerU 并获取 batch_id
 */
async function uploadPDF(
  apiKey: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const dataId = `$document_${Date.now()}`;

  onProgress?.("Requesting upload URL...");

  const resp = await fetch(`${BASE_URL}/file-urls/batch`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ name: fileName, data_id: dataId }],
      model_version: "vlm",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Upload request failed: ${resp.status}`);
  }

  const resData = (await resp.json()) as unknown as BatchResponse;
  if (resData.code !== 0) {
    throw new Error(`Upload request rejected: ${JSON.stringify(resData)}`);
  }

  const batchId = resData.data.batch_id;
  const uploadUrl = resData.data.file_urls[0];

  onProgress?.("Uploading PDF...");

  const upResp = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBuffer,
  });

  if (!upResp.ok) {
    throw new Error(`Upload failed: ${upResp.status}`);
  }

  return batchId;
}

/**
 * 轮询等待解析完成，返回 ZIP 下载链接
 */
async function waitForExtraction(
  apiKey: string,
  batchId: string,
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const statusUrl = `${BASE_URL}/extract-results/batch/${batchId}`;

  const maxRetries = 120;
  for (let i = 0; i < maxRetries; i++) {
    onProgress?.(`Parsing... (${i * 5}s)`);

    const resp = await fetch(statusUrl, { headers });
    if (resp.ok) {
      const resJson = (await resp.json()) as unknown as ExtractResultsResponse;
      const result = resJson.data.extract_result[0];

      if (result.full_zip_url) {
        return result.full_zip_url;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Extraction timeout");
}

/**
 * 从 ZIP 中提取 Markdown
 */
async function extractMarkdown(zipUrl: string): Promise<string> {
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

  // 将结果转为符合现代标准的 Uint8Array
  const arrayBuffer = await resp.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);

  try {
    // fflate 的同步方法在处理 50KB 这种小文件时效率最高且不会阻塞线程
    const unzipped = unzipSync(zipData);

    // 查找目标文件
    const targetKey = Object.keys(unzipped).find((name) =>
      name.endsWith("full.md"),
    );

    if (!targetKey) {
      throw new Error("full.md not found");
    }

    // 将二进制直接转为字符串（UTF-8）
    return strFromU8(unzipped[targetKey]);
  } catch (err) {
    throw new Error("Decompression failed", { cause: err });
  }
}

/**
 * 完整的 PDF 解析流程
 */
export async function parsePDFWithMinerU(
  filePath: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const apiKey = getMinerUApiKey();
  if (!apiKey) {
    throw new Error("MinerU API key not configured");
  }

  // 读取文件
  onProgress?.("Reading PDF file...");

  // 在 Zotero 环境中读取文件
  const fileBuffer = await readFileAsArrayBuffer(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || "document.pdf";

  // 上传并解析
  const batchId = await uploadPDF(apiKey, fileName, fileBuffer, onProgress);
  if (!batchId) {
    throw new Error("Failed to upload PDF");
  }

  // 等待解析完成
  const zipUrl = await waitForExtraction(apiKey, batchId, onProgress);
  if (!zipUrl) {
    throw new Error("Extraction failed");
  }

  // 提取 Markdown
  onProgress?.("Extracting markdown...");
  const markdown = await extractMarkdown(zipUrl);

  return markdown;
}

/**
 * 读取文件为 ArrayBuffer（Zotero 环境）
 */
async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const nsiFile = Zotero.File.pathToFile(filePath);
  const uint8Array = await IOUtils.read(nsiFile.path);
  const buffer = new ArrayBuffer(uint8Array.byteLength);
  new Uint8Array(buffer).set(uint8Array);
  return buffer;
}
