# Run Opencode Serve
```bash
cd path/to/project
opencode serve
```
## Usage

```bash
node opencode-tool.js [options] "prompt/input"
```

## Options

| Tùy chọn | Mô tả |
| :--- | :--- |
| `-p, --port <number>` | Port của server (mặc định: `4096`) |
| `--host <string>` | Host của server (mặc định: `127.0.0.1`) |
| `--provider <string>` | Provider ID (mặc định: `myprovider`) |
| `-m, --model <string>` | Model ID (mặc định: `GPT-4o`) |
| `--new` | Tạo session mới (bỏ qua session cũ) |
| `--list` | Liệt kê tất cả sessions đã lưu |
| `--delete` | Xóa session của server được chỉ định |
| `--clear` | Xóa tất cả sessions |
| `-h, --help` | Hiển thị trợ giúp |

## Ví dụ

**Gửi prompt đến server mặc định (port 4096):**
```bash
node opencode-tool.js "Hello, AI!"
```

**Gửi prompt đến server khác (project khác):**
```bash
node opencode-tool.js -p 4097 "Phân tích code"
```

**Tạo session mới:**
```bash
node opencode-tool.js --new "Bắt đầu conversation mới"
```

**Quản lý sessions:**
```bash
node opencode-tool.js --list
node opencode-tool.js --delete -p 4096
node opencode-tool.js --clear
```

## Multi-project Workflow

Giả lập môi trường làm việc với nhiều dự án cùng lúc:

**1. Terminal 1: Serve project A trên port 4096**
```bash
cd D:\ProjectA && opencode serve --port 4096
```

**2. Terminal 2: Serve project B trên port 4097**
```bash
cd D:\ProjectB && opencode serve --port 4097
```

**3. Gửi prompt đến project A**
```bash
node opencode-tool.js -p 4096 "Làm việc với Project A"
```

**4. Gửi prompt đến project B**
```bash
node opencode-tool.js -p 4097 "Làm việc với Project B"
```