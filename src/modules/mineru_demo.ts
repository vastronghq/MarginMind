import * as fs from "fs";
import AdmZip from "adm-zip";

// --- 配置参数 ---
const TOKEN =
  "eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiIzMDMwMDQ1MyIsInJvbCI6IlJPTEVfUkVHSVNURVIiLCJpc3MiOiJPcGVuWExhYiIsImlhdCI6MTc3NDc2NzY3OCwiY2xpZW50SWQiOiJsa3pkeDU3bnZ5MjJqa3BxOXgydyIsInBob25lIjoiIiwib3BlbklkIjpudWxsLCJ1dWlkIjoiZjYyZmM5MGMtMGFlNi00MTlhLTk4YTEtY2Y4ZTE2MzU4MDkzIiwiZW1haWwiOiIiLCJleHAiOjE3ODI1NDM2Nzh9.d2zJ4jmZSq6CBy6SJFUQQXsRCVFzWnM5JML4P7U5E9WrFqc83iqnyDPSkumIdBYWsVQq6dUyBnEvXMjVqWwOCA";
const BASE_URL = "https://mineru.net/api/v4";
const HEADERS = { Authorization: `Bearer ${TOKEN}` };

// 待处理的文件信息
const FILE_CONFIG = {
  local_path: "example.pdf", // 本地文件路径
  name: "example.pdf", // 服务器记录的文件名
  data_id: Date.now().toString(), // 自定义 ID
};

interface BatchResponse {
  code: number;
  data: {
    batch_id: string;
    file_urls: string[];
  };
}

interface ExtractResult {
  state: string;
  full_zip_url: string | null;
}

interface ExtractResultsResponse {
  data: {
    extract_result: ExtractResult[];
  };
}

async function processPDF(): Promise<string | undefined> {
  // --- 第一步：申请上传 URL ---
  console.log("Step 1: 正在申请上传地址...");
  const batchUrl = `${BASE_URL}/file-urls/batch`;
  const payload = {
    files: [{ name: FILE_CONFIG.name, data_id: FILE_CONFIG.data_id }],
    model_version: "vlm",
  };

  const resp = await fetch(batchUrl, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    console.error(`申请失败: ${resp.status} ${resp.statusText}`);
    return;
  }

  const resData: BatchResponse = await resp.json();
  if (resData.code !== 0) {
    console.error(`申请失败: ${JSON.stringify(resData)}`);
    return;
  }

  const batchId = resData.data.batch_id;
  const uploadUrl = resData.data.file_urls[0];
  console.log(`申请成功! Batch ID: ${batchId}`);

  // --- 第二步：执行二进制上传 ---
  console.log(`Step 2: 正在上传文件 ${FILE_CONFIG.local_path}...`);
  const fileBuffer = fs.readFileSync(FILE_CONFIG.local_path);
  const upResp = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBuffer,
  });

  if (!upResp.ok) {
    console.error(`上传失败，状态码: ${upResp.status}`);
    return;
  }
  console.log(`上传成功！batch_id: ${batchId}`);

  // --- 第三步：轮询解析结果 ---
  console.log("Step 3: 开始轮询解析状态 (每 5 秒检查一次)...");
  const statusUrl = `${BASE_URL}/extract-results/batch/${batchId}`;

  const maxRetries = 60; // 最多等待 5 分钟
  for (let i = 0; i < maxRetries; i++) {
    const statusResp = await fetch(statusUrl, { headers: HEADERS });

    if (statusResp.ok) {
      const resJson: ExtractResultsResponse = await statusResp.json();
      const data = resJson.data;

      // 判断是否完成
      if (data.extract_result[0].full_zip_url) {
        console.log("\n🎉 解析完成！");
        console.log("-".repeat(30));
        console.log(`提取状态: ${data.extract_result[0].state}`);
        console.log(
          `全量 ZIP 下载地址: ${data.extract_result[0].full_zip_url}`,
        );
        console.log("-".repeat(30));
        return data.extract_result[0].full_zip_url;
      } else {
        // 打印进度提示
        process.stdout.write(`\r解析中... 已耗时约 ${i * 5}s`);
      }
    } else {
      console.error(`\n查询状态出错: ${statusResp.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("\n达到最大等待时间，请稍后手动检查。");
}

async function extractMarkdown(link: string): Promise<string | null> {
  console.log(`正在下载 ZIP 文件: ${link}`);
  const resp = await fetch(link);

  if (!resp.ok) {
    console.error(`下载失败，状态码: ${resp.status}`);
    return null;
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("full.md");
  if (!entry) {
    console.error("ZIP 中未找到 full.md");
    return null;
  }
  return entry.getData().toString("utf-8");
}

async function main() {
  const link = await processPDF();
  if (link) {
    console.log(link);
    const text = await extractMarkdown(link);
    if (text) {
      console.log(text);
    }
  }
}

main().catch(console.error);

// export { processPDF, extractMarkdown };
