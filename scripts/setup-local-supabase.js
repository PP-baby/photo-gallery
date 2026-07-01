const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const defaultUrl = "https://lbvzfyxxtaggqnyehsrh.supabase.co";
const defaultBucket = "photos";

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    const urlAnswer = await rl.question(`SUPABASE_URL (${defaultUrl}): `);
    const keyAnswer = await rl.question("SUPABASE_SERVICE_ROLE_KEY: ");
    const bucketAnswer = await rl.question(`SUPABASE_BUCKET (${defaultBucket}): `);

    const supabaseUrl = (urlAnswer || defaultUrl).trim();
    const serviceRoleKey = keyAnswer.trim();
    const bucket = (bucketAnswer || defaultBucket).trim();

    if (!/^https:\/\/.+\.supabase\.co$/.test(supabaseUrl)) {
      throw new Error("SUPABASE_URL 格式不正确。");
    }

    if (!serviceRoleKey || serviceRoleKey.length < 40) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY 不能为空，请粘贴 service_role key。");
    }

    const envContent = [
      `SUPABASE_URL=${supabaseUrl}`,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
      `SUPABASE_BUCKET=${bucket}`,
      "MAX_UPLOAD_MB=50",
      "",
    ].join("\n");

    await fs.writeFile(envPath, envContent, "utf8");
    console.log(`已写入 ${envPath}`);
    console.log("现在重新运行 npm start，本地将直连 Supabase。");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
