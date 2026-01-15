# OpenCode

## Cài đặt

```bash
npm install @opencode-ai/sdk
```

## Cách dùng

### Gửi prompt

```bash
# Dùng session gần nhất (hoặc tạo mới nếu chưa có)
node opencode-tool.js "Hello, AI!"

# Tạo session mới
node opencode-tool.js --new "Bắt đầu project mới"

# Dùng session cụ thể
node opencode-tool.js -s ses_abc123 "Tiếp tục conversation"
```

### Quản lý sessions

```bash
# Liệt kê tất cả sessions
node opencode-tool.js --list

# Xem messages của session
node opencode-tool.js --messages -s ses_abc123

# Đổi tên session
node opencode-tool.js --rename "My Project" -s ses_abc123

# Xóa session
node opencode-tool.js --delete -s ses_abc123
```

### Options

| Option | Mô tả |
|--------|-------|
| `-s, --session <id>` | Chọn session theo ID |
| `--new` | Tạo session mới |
| `--list` | Liệt kê sessions |
| `--messages` | Xem messages (yêu cầu `-s`) |
| `--rename <title>` | Đổi tên session (yêu cầu `-s`) |
| `--delete` | Xóa session (yêu cầu `-s`) |
| `-p, --port <num>` | Port server (mặc định: 4096) |
| `--host <host>` | Host server (mặc định: 127.0.0.1) |
| `-m, --model <id>` | Model ID (mặc định: GPT-4o) |
| `--provider <id>` | Provider ID (mặc định: myprovider) |

## Multi-project workflow

```bash
# Terminal 1: Serve project A
cd D:\ProjectA && opencode serve --port 4096

# Terminal 2: Serve project B
cd D:\ProjectB && opencode serve --port 4097

# Gửi prompt đến project A
node opencode-tool.js -p 4096 "Làm việc với Project A"

# Gửi prompt đến project B
node opencode-tool.js -p 4097 "Làm việc với Project B"
```

## Sử dụng như module

```javascript
import { 
  sendToOpenCode, 
  listSessions, 
  createSession 
} from "./opencode-tool.js";

// Gửi prompt
const result = await sendToOpenCode({
  input: "Hello!",
  port: 4096,
});
console.log(result.textResponse);

// Liệt kê sessions
const client = createClient("127.0.0.1", 4096);
const sessions = await listSessions(client);
```

## API Reference

| Function | Mô tả |
|----------|-------|
| `sendToOpenCode(options)` | Gửi prompt |
| `createClient(host, port)` | Tạo client |
| `listSessions(client)` | Lấy danh sách sessions |
| `getSession(client, id)` | Lấy session theo ID |
| `createSession(client, title)` | Tạo session mới |
| `deleteSession(client, id)` | Xóa session |
| `renameSession(client, id, title)` | Đổi tên session |
| `getSessionMessages(client, id)` | Lấy messages |
| `resolveSession(client, id, forceNew)` | Smart session selection |
