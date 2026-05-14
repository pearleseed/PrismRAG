# 🚀 PrismRAG Scripts Guide | Hướng dẫn chạy Script

To keep the project root clean, all startup and setup scripts have been moved to the `scripts/` directory.
Để giữ thư mục gốc gọn gàng, tất cả các script khởi động và cài đặt đã được chuyển vào thư mục `scripts/`.

---

## 🛠️ Setup | Cài đặt

Before running the services for the first time, run the setup script:
Trước khi chạy dịch vụ lần đầu tiên, hãy chạy script cài đặt:

```bash
# macOS / Linux
./scripts/setup.sh

# Windows (Git Bash)
./scripts/setup.sh
```

---

## 🏃 Running Services | Chạy dịch vụ

### 1. Database (ChromaDB)
Start ChromaDB first:
Khởi động ChromaDB trước:

```bash
# macOS / Linux
./scripts/run/run_db.sh

# Windows (PowerShell)
.\scripts\run\run_db.ps1
```

### 2. Backend API
Start the FastAPI backend:
Khởi động backend FastAPI:

```bash
# macOS / Linux
./scripts/run/run_bk.sh

# Windows (PowerShell)
.\scripts\run\run_bk.ps1
```

### 3. Frontend
Start the React frontend:
Khởi động frontend React:

```bash
# macOS / Linux
./scripts/run/run_fe.sh

# Windows (PowerShell)
.\scripts\run\run_fe.ps1
```

---

## 🌐 Open WebUI (Optional)
To run Open WebUI (after backend is running):
Để chạy Open WebUI (sau khi backend đã hoạt động):

```bash
./scripts/run/run_ow.sh
```

---

> [!NOTE]
> All scripts automatically detect the repository root and handle environment activation.
> Tất cả các script tự động nhận diện thư mục gốc và kích hoạt môi trường ảo.
