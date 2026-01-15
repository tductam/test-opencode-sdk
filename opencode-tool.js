import { createOpencodeClient } from "@opencode-ai/sdk";

// Default config
const DEFAULT_PORT = 4096;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PROVIDER = "myprovider";
const DEFAULT_MODEL = "GPT-4o";

/**
 * Create OpenCode client
 * @param {string} host - Server host
 * @param {number} port - Server port
 * @returns {object} - OpenCode client
 */
function createClient(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    return createOpencodeClient({
        baseUrl: `http://${host}:${port}`,
    });
}

/**
 * Get all sessions from server (sorted by updatedAt desc)
 * @param {object} client - OpenCode client
 * @returns {Promise<object[]>} - List of sessions
 */
async function listSessions(client) {
    const res = await client.session.list();
    const sessions = res.data || [];
    // Sort by updatedAt descending (newest first)
    return sessions.sort((a, b) =>
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
}

/**
 * Get latest session from server
 * @param {object} client - OpenCode client
 * @returns {Promise<object|null>} - Latest session or null
 */
async function getLatestSession(client) {
    const sessions = await listSessions(client);
    return sessions.length > 0 ? sessions[0] : null;
}

/**
 * Get session by ID
 * @param {object} client - OpenCode client
 * @param {string} sessionId - Session ID
 * @returns {Promise<object|null>} - Session or null
 */
async function getSession(client, sessionId) {
    try {
        const res = await client.session.get({ path: { id: sessionId } });
        return res.data || null;
    } catch (error) {
        return null;
    }
}

/**
 * Create new session
 * @param {object} client - OpenCode client
 * @param {string} title - Session title
 * @returns {Promise<object>} - New session
 */
async function createSession(client, title = "New Session") {
    const res = await client.session.create({
        body: { title },
    });
    if (!res.data?.id) {
        throw new Error("Không thể tạo session mới");
    }
    return res.data;
}

/**
 * Delete session by ID
 * @param {object} client - OpenCode client
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - Success
 */
async function deleteSession(client, sessionId) {
    try {
        await client.session.delete({ path: { id: sessionId } });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Rename session
 * @param {object} client - OpenCode client
 * @param {string} sessionId - Session ID
 * @param {string} newTitle - New title
 * @returns {Promise<object|null>} - Updated session or null
 */
async function renameSession(client, sessionId, newTitle) {
    try {
        const res = await client.session.update({
            path: { id: sessionId },
            body: { title: newTitle },
        });
        return res.data || null;
    } catch (error) {
        return null;
    }
}

/**
 * Get messages of a session
 * @param {object} client - OpenCode client
 * @param {string} sessionId - Session ID
 * @returns {Promise<object[]>} - Messages
 */
async function getSessionMessages(client, sessionId) {
    try {
        const res = await client.session.messages({ path: { id: sessionId } });
        return res.data || [];
    } catch (error) {
        return [];
    }
}

/**
 * Resolve session based on options
 * @param {object} client - OpenCode client
 * @param {string|null} sessionArg - Session ID or "last"
 * @param {boolean} forceNew - Force create new session
 * @returns {Promise<object>} - Session
 */
async function resolveSession(client, sessionArg, forceNew = false) {
    // Force new session
    if (forceNew) {
        const session = await createSession(client);
        console.log(`✅ Đã tạo session mới: ${session.id}`);
        return session;
    }

    // Use specific session ID
    if (sessionArg && sessionArg !== "last") {
        const session = await getSession(client, sessionArg);
        if (!session) {
            throw new Error(`Session không tồn tại: ${sessionArg}`);
        }
        return session;
    }

    // Use latest session (default)
    const latest = await getLatestSession(client);
    if (latest) {
        return latest;
    }

    // No sessions exist, create new one
    const session = await createSession(client);
    console.log(`✅ Đã tạo session mới: ${session.id}`);
    return session;
}

/**
 * Send prompt to OpenCode
 * @param {object} options - Options
 * @returns {Promise<object>} - Response
 */
async function sendToOpenCode(options) {
    const {
        input,
        port = DEFAULT_PORT,
        host = DEFAULT_HOST,
        provider = DEFAULT_PROVIDER,
        model = DEFAULT_MODEL,
        sessionId = null,
        newSession = false,
    } = options;

    if (!input) {
        throw new Error("input là bắt buộc");
    }

    const client = createClient(host, port);
    const session = await resolveSession(client, sessionId, newSession);

    // Send prompt
    const promptRes = await client.session.prompt({
        path: { id: session.id },
        body: {
            model: { providerID: provider, modelID: model },
            parts: [{ type: "text", text: input }],
        },
    });

    const responseData = promptRes.data || promptRes;

    return {
        sessionId: session.id,
        sessionTitle: session.title,
        server: `${host}:${port}`,
        response: responseData,
        textResponse: responseData.parts?.find((p) => p.type === "text")?.text || null,
    };
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN");
}

// CLI Support
async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    const newSession = args.includes("--new");
    const listMode = args.includes("--list");
    const deleteMode = args.includes("--delete");
    const messagesMode = args.includes("--messages");
    const renameMode = args.includes("--rename");
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
    const sessionArg = getOption("--session") || getOption("-s");

    // Help
    if (helpMode) {
        console.log(`
OpenCode Tool - Gửi input đến OpenCode server (SDK-based)

Cách dùng:
  node opencode-tool.js [options] "prompt/input"

Session Options:
  -s, --session <id>    Chọn session theo ID (hoặc "last" cho session gần nhất)
  --new                 Tạo session mới
  --list                Liệt kê tất cả sessions từ server
  --delete              Xóa session (yêu cầu -s)
  --messages            Xem lịch sử messages của session (yêu cầu -s)
  --rename <title>      Đổi tên session (yêu cầu -s)

Server Options:
  -p, --port <number>   Port của server (mặc định: 4096)
  --host <string>       Host của server (mặc định: 127.0.0.1)
  --provider <string>   Provider ID (mặc định: myprovider)
  -m, --model <string>  Model ID (mặc định: GPT-4o)

Other:
  -h, --help            Hiển thị trợ giúp

Ví dụ:
  # Gửi prompt (dùng session gần nhất, hoặc tạo mới nếu chưa có)
  node opencode-tool.js "Hello, AI!"

  # Tạo session mới và gửi prompt
  node opencode-tool.js --new "Bắt đầu project mới"

  # Dùng session cụ thể
  node opencode-tool.js -s ses_abc123 "Tiếp tục conversation"

  # Quản lý sessions
  node opencode-tool.js --list
  node opencode-tool.js --messages -s ses_abc123
  node opencode-tool.js --rename "My Project" -s ses_abc123
  node opencode-tool.js --delete -s ses_abc123
`);
        return;
    }

    try {
        const client = createClient(host, port);

        // List sessions
        if (listMode) {
            const sessions = await listSessions(client);
            if (sessions.length === 0) {
                console.log("📭 Không có session nào.");
            } else {
                console.log(`📋 Danh sách ${sessions.length} session(s):\n`);
                for (const s of sessions) {
                    console.log(`  🔑 ${s.id}`);
                    console.log(`     📌 Title: ${s.title || "(Không có)"}`);
                    console.log(`     📅 Updated: ${formatDate(s.updatedAt)}`);
                    console.log();
                }
            }
            return;
        }

        // Delete session
        if (deleteMode) {
            if (!sessionArg) {
                console.error("❌ LỖI: Cần chỉ định session ID với -s");
                return;
            }
            if (await deleteSession(client, sessionArg)) {
                console.log(`✅ Đã xóa session: ${sessionArg}`);
            } else {
                console.log(`❌ Không thể xóa session: ${sessionArg}`);
            }
            return;
        }

        // View messages
        if (messagesMode) {
            const targetSession = sessionArg || (await getLatestSession(client))?.id;
            if (!targetSession) {
                console.error("❌ LỖI: Không có session nào");
                return;
            }
            const messages = await getSessionMessages(client, targetSession);
            if (messages.length === 0) {
                console.log("📭 Session không có messages.");
            } else {
                console.log(`📜 Messages của session ${targetSession}:\n`);
                for (const msg of messages) {
                    const role = msg.info?.role || "unknown";
                    const icon = role === "user" ? "👤" : "🤖";
                    console.log(`${icon} [${role.toUpperCase()}]`);
                    if (msg.parts) {
                        for (const part of msg.parts) {
                            if (part.type === "text") {
                                console.log(`   ${part.text.substring(0, 200)}${part.text.length > 200 ? "..." : ""}`);
                            }
                        }
                    }
                    console.log();
                }
            }
            return;
        }

        // Rename session
        if (renameMode) {
            if (!sessionArg) {
                console.error("❌ LỖI: Cần chỉ định session ID với -s");
                return;
            }
            const newTitle = getOption("--rename");
            if (!newTitle) {
                console.error("❌ LỖI: Cần cung cấp title mới");
                return;
            }
            const updated = await renameSession(client, sessionArg, newTitle);
            if (updated) {
                console.log(`✅ Đã đổi tên session: "${newTitle}"`);
            } else {
                console.log(`❌ Không thể đổi tên session: ${sessionArg}`);
            }
            return;
        }

        // Get input (exclude flags and options)
        const flagsAndOptions = [
            "--new", "--list", "--delete", "--messages", "--rename",
            "--help", "-h", "--port", "-p", "--host", "--provider",
            "--model", "-m", "--session", "-s",
        ];

        const input = args
            .filter((arg, idx) => {
                if (flagsAndOptions.includes(arg)) return false;
                const prevArg = args[idx - 1];
                if (prevArg && [
                    "--port", "-p", "--host", "--provider", "--model", "-m",
                    "--session", "-s", "--rename"
                ].includes(prevArg)) {
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

        // Send prompt
        console.log(`📡 Server: http://${host}:${port}`);
        console.log(`📩 Đang gửi: "${input.substring(0, 50)}${input.length > 50 ? "..." : ""}"\n`);

        const result = await sendToOpenCode({
            input,
            port,
            host,
            provider,
            model,
            sessionId: sessionArg,
            newSession,
        });

        console.log(`🔑 Session: ${result.sessionId}`);
        if (result.sessionTitle) {
            console.log(`📌 Title: ${result.sessionTitle}`);
        }
        console.log("\n💬 ----- PHẢN HỒI TỪ AI -----");
        console.log(result.textResponse || "(Không có văn bản)");
        console.log("-----------------------------\n");

    } catch (error) {
        if (error.code === "ECONNREFUSED") {
            console.error(`\n❌ LỖI: Không thể kết nối đến server tại http://${host}:${port}`);
            console.log("👉 Hãy chạy OpenCode server trước:");
            console.log(`   cd <project_folder> && opencode serve --port ${port}`);
        } else {
            console.error("❌ Lỗi:", error.message || error);
        }
    }
}

// Export for use as module
export {
    createClient,
    sendToOpenCode,
    listSessions,
    getLatestSession,
    getSession,
    createSession,
    deleteSession,
    renameSession,
    getSessionMessages,
    resolveSession,
};

// Run CLI if executed directly
const isMain = process.argv[1]?.endsWith("opencode-tool.js");
if (isMain) {
    main();
}
