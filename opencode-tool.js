import { createOpencodeClient } from "@opencode-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Default config
const DEFAULT_PORT = 4096;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PROVIDER = "myprovider";
const DEFAULT_MODEL = "GPT-4o";

// Sessions storage directory
const SESSIONS_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    ".opencode-sessions"
);

/**
 * Get session file path for a specific server (by host:port)
 * @param {string} host - Server host
 * @param {number} port - Server port
 * @returns {string} - Path to session file
 */
function getSessionFilePath(host, port) {
    const safeName = `${host}_${port}`.replace(/[.:]/g, "_");
    return path.join(SESSIONS_DIR, `${safeName}.session`);
}

/**
 * Ensure sessions directory exists
 */
function ensureSessionsDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
}

/**
 * Get or create session for a server
 * @param {object} client - OpenCode client
 * @param {string} host - Server host
 * @param {number} port - Server port
 * @param {boolean} forceNew - Force create new session
 * @returns {Promise<string>} - Session ID
 */
async function getOrCreateSession(client, host, port, forceNew = false) {
    ensureSessionsDir();
    const sessionFile = getSessionFilePath(host, port);

    // Check for existing session
    if (!forceNew && fs.existsSync(sessionFile)) {
        const sessionId = fs.readFileSync(sessionFile, "utf-8").trim();
        try {
            // Verify session still exists
            const session = await client.session.get({ path: { id: sessionId } });
            if (session.data?.id) {
                return sessionId;
            }
        } catch (error) {
            // Session invalid, will create new one
            console.log("⚠️ Session không hợp lệ, tạo mới...");
        }
    }

    // Create new session
    const createRes = await client.session.create({
        body: { title: `Session - ${host}:${port}` },
    });
    const newId = createRes.data?.id;
    if (!newId) {
        throw new Error("Không thể tạo session mới");
    }

    // Save session ID
    fs.writeFileSync(sessionFile, newId);
    console.log(`✅ Đã tạo session mới: ${newId}`);
    return newId;
}

/**
 * Send prompt to OpenCode
 * @param {object} options - Options
 * @param {string} options.input - Input text/prompt
 * @param {number} options.port - Server port (default: 4096)
 * @param {string} options.host - Server host (default: 127.0.0.1)
 * @param {string} options.provider - Provider ID (default: myprovider)
 * @param {string} options.model - Model ID (default: GPT-4o)
 * @param {boolean} options.newSession - Force new session
 * @returns {Promise<object>} - Response from OpenCode
 */
async function sendToOpenCode(options) {
    const {
        input,
        port = DEFAULT_PORT,
        host = DEFAULT_HOST,
        provider = DEFAULT_PROVIDER,
        model = DEFAULT_MODEL,
        newSession = false,
    } = options;

    if (!input) {
        throw new Error("input là bắt buộc");
    }

    const client = createOpencodeClient({
        baseUrl: `http://${host}:${port}`,
    });

    // Get or create session for this server
    const sessionId = await getOrCreateSession(client, host, port, newSession);

    // Send prompt
    const promptRes = await client.session.prompt({
        path: { id: sessionId },
        body: {
            model: { providerID: provider, modelID: model },
            parts: [{ type: "text", text: input }],
        },
    });

    const responseData = promptRes.data || promptRes;

    return {
        sessionId,
        server: `${host}:${port}`,
        response: responseData,
        textResponse: responseData.parts?.find((p) => p.type === "text")?.text || null,
    };
}

/**
 * List all sessions
 * @returns {object[]} - List of sessions with their servers
 */
function listSessions() {
    ensureSessionsDir();
    const sessions = [];

    if (!fs.existsSync(SESSIONS_DIR)) {
        return sessions;
    }

    const files = fs.readdirSync(SESSIONS_DIR);
    for (const file of files) {
        if (file.endsWith(".session")) {
            const sessionId = fs
                .readFileSync(path.join(SESSIONS_DIR, file), "utf-8")
                .trim();
            // Parse server info from filename
            const serverName = file.replace(".session", "").replace(/_/g, ":");
            sessions.push({
                sessionId,
                server: serverName.replace(/:(\d+)$/, ":$1"), // Format as host:port
                sessionFile: path.join(SESSIONS_DIR, file),
            });
        }
    }

    return sessions;
}

/**
 * Delete session for a server
 * @param {string} host - Server host
 * @param {number} port - Server port
 * @returns {boolean} - True if deleted
 */
function deleteSession(host, port) {
    const sessionFile = getSessionFilePath(host, port);
    if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
        return true;
    }
    return false;
}

/**
 * Clear all sessions
 * @returns {number} - Number of sessions deleted
 */
function clearAllSessions() {
    ensureSessionsDir();
    let count = 0;

    if (!fs.existsSync(SESSIONS_DIR)) {
        return count;
    }

    const files = fs.readdirSync(SESSIONS_DIR);
    for (const file of files) {
        if (file.endsWith(".session")) {
            fs.unlinkSync(path.join(SESSIONS_DIR, file));
            count++;
        }
    }
    return count;
}

// CLI Support
async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    const newSession = args.includes("--new");
    const listMode = args.includes("--list");
    const clearMode = args.includes("--clear");
    const deleteMode = args.includes("--delete");
    const helpMode = args.includes("--help") || args.includes("-h");

    // Parse options
    const getOption = (flag) => {
        const idx = args.indexOf(flag);
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    const port = parseInt(getOption("--port") || getOption("-p")) || DEFAULT_PORT;
    const host = getOption("--host") || DEFAULT_HOST;
    const provider = getOption("--provider") || DEFAULT_PROVIDER;
    const model = getOption("--model") || getOption("-m") || DEFAULT_MODEL;

    // Help
    if (helpMode) {
        console.log(`
OpenCode Tool - Gửi input đến OpenCode server

⚠️  LƯU Ý: OpenCode server được serve cho MỘT thư mục cố định khi khởi động.
    Muốn làm việc với nhiều project, chạy nhiều server trên các port khác nhau.

Cách dùng:
  node opencode-tool.js [options] "prompt/input"

Options:
  -p, --port <number>   Port của server (mặc định: 4096)
  --host <string>       Host của server (mặc định: 127.0.0.1)
  --provider <string>   Provider ID (mặc định: myprovider)
  -m, --model <string>  Model ID (mặc định: GPT-4o)
  --new                 Tạo session mới (bỏ qua session cũ)
  --list                Liệt kê tất cả sessions đã lưu
  --delete              Xóa session của server được chỉ định
  --clear               Xóa tất cả sessions
  -h, --help            Hiển thị trợ giúp

Ví dụ:
  # Gửi prompt đến server mặc định (port 4096)
  node opencode-tool.js "Hello, AI!"

  # Gửi prompt đến server khác (project khác)
  node opencode-tool.js -p 4097 "Phân tích code"

  # Tạo session mới
  node opencode-tool.js --new "Bắt đầu conversation mới"

  # Quản lý sessions
  node opencode-tool.js --list
  node opencode-tool.js --delete -p 4096
  node opencode-tool.js --clear

Multi-project workflow:
  # Terminal 1: Serve project A trên port 4096
  cd D:\\ProjectA && opencode serve --port 4096

  # Terminal 2: Serve project B trên port 4097  
  cd D:\\ProjectB && opencode serve --port 4097

  # Gửi prompt đến project A
  node opencode-tool.js -p 4096 "Làm việc với Project A"

  # Gửi prompt đến project B
  node opencode-tool.js -p 4097 "Làm việc với Project B"
`);
        return;
    }

    // List sessions
    if (listMode) {
        const sessions = listSessions();
        if (sessions.length === 0) {
            console.log("📭 Không có session nào được lưu.");
        } else {
            console.log(`📋 Danh sách ${sessions.length} session(s):\n`);
            for (const s of sessions) {
                console.log(`  � Server: ${s.server}`);
                console.log(`     Session: ${s.sessionId}\n`);
            }
        }
        return;
    }

    // Clear all sessions
    if (clearMode) {
        const count = clearAllSessions();
        console.log(`🗑️  Đã xóa ${count} session(s).`);
        return;
    }

    // Delete session for server
    if (deleteMode) {
        if (deleteSession(host, port)) {
            console.log(`✅ Đã xóa session cho: ${host}:${port}`);
        } else {
            console.log(`⚠️ Không tìm thấy session cho: ${host}:${port}`);
        }
        return;
    }

    // Get input (exclude flags and options)
    const flagsAndOptions = [
        "--new",
        "--list",
        "--clear",
        "--delete",
        "--help",
        "-h",
        "--port",
        "-p",
        "--host",
        "--provider",
        "--model",
        "-m",
    ];

    const input = args
        .filter((arg, idx) => {
            if (flagsAndOptions.includes(arg)) return false;
            const prevArg = args[idx - 1];
            if (
                prevArg &&
                ["--port", "-p", "--host", "--provider", "--model", "-m"].includes(prevArg)
            ) {
                return false;
            }
            return true;
        })
        .join(" ");

    if (!input) {
        console.error("❌ LỖI: Bạn chưa nhập prompt/input!");
        console.log('👉 Cách dùng: node opencode-tool.js "Prompt của bạn"');
        console.log("👉 Xem thêm: node opencode-tool.js --help");
        return;
    }

    try {
        console.log(`📡 Server: http://${host}:${port}`);
        console.log(`📩 Đang gửi: "${input.substring(0, 50)}${input.length > 50 ? "..." : ""}"\n`);

        const result = await sendToOpenCode({
            input,
            port,
            host,
            provider,
            model,
            newSession,
        });

        console.log(`🔑 Session ID: ${result.sessionId}`);
        console.log("\n💬 ----- PHẢN HỒI TỪ AI -----");
        console.log(result.textResponse || "(Không có văn bản)");
        console.log("-----------------------------\n");
    } catch (error) {
        if (error.code === "ECONNREFUSED") {
            console.error(
                `\n❌ LỖI: Không thể kết nối đến server tại http://${host}:${port}`
            );
            console.log("👉 Hãy chạy OpenCode server trước:");
            console.log(`   cd <project_folder> && opencode serve --port ${port}`);
        } else {
            console.error("❌ Lỗi:", error.message || error);
        }
    }
}

// Export for use as module
export {
    sendToOpenCode,
    getOrCreateSession,
    listSessions,
    deleteSession,
    clearAllSessions,
    getSessionFilePath,
};

// Run CLI if executed directly
const isMain = process.argv[1]?.endsWith("opencode-tool.js");
if (isMain) {
    main();
}
