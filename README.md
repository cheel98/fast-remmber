# Fast Remmber (Idiom Semantic Network)

这是一个成语/词汇语义网络（Idiom Semantic Network）的可视化项目。项目旨在通过力导向图的形式探索和展示成语/词汇之间的关联、含义、情感色彩及同义词/反义词。结合了大语言模型（LLM）的动态解析能力与图数据库（Neo4j）的强大关联存储。

## 目录结构
- `frontend/`: 前端应用（基于 Next.js 15, React 19, TailwindCSS, Radix UI）
- `backend/`: 后端服务（基于 Go 1.25, Gin, Neo4j, 以及适配 OpenAI 规范的大模型 API 交互）

## 环境依赖前期准备

在运行项目前，请确保您在本地计算机准备好以下环境：
1. **Node.js** (推荐 v20 或以上版本)
2. **pnpm** (前端依赖管理工具)
3. **Go** (推荐 v1.25.0 及以上版本)
4. **Neo4j Desktop / Neo4j Docker** (图数据库，用于存储语义网络节点及关系)

---

## 后端启动指南 (Backend)

后端主要负责处理业务逻辑、同 Neo4j 交互，以及提供调用 LLM（大模型）对未知成语进行释义解析的能力。

1. **进入后端目录**：
   ```bash
   cd backend
   ```

2. **配置环境变量**：
   复制配置文件示例并修改为您自己的真实数据环境。
   ```bash
   cp .env.example .env
   ```
   **配置文件 (`.env`) 说明：**
   ```dotenv
   # LLM 设置 (OpenAI 兼容接口)
   LLM_API_KEY="your_api_key_here"
   LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1" # 或您的其他提供商 API 地址
   LLM_MODEL="gpt-5.4-mini" # 您选用的具体模型名称，例如 gpt-4o, deepseek-chat 等

   # Neo4j 连接配置
   NEO4J_URI="bolt://localhost:7687"
   NEO4J_USER="neo4j"
   NEO4J_PASSWORD="password"
   ```

3. **下载依赖并运行**：
   ```bash
   go mod tidy
   go run main.go
   ```
   如果配置正确，后端服务会自动连接大模型接口与 Neo4j 数据库。

---

## 前端启动指南 (Frontend)

前端采用 Next.js 构建，集成了响应式UI、力导向图可视化引擎以及丰富的视觉主题与动效。

1. **进入前端目录**：
   ```bash
   cd frontend 
   ```

2. **安装依赖**：
   建议使用 `pnpm`。
   ```bash
   pnpm install
   ```

3. **启动开发服务器**：
   ```bash
   pnpm run dev
   ```

4. **预览项目**：
   打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始探索应用。

---

## 核心特性列表

- 🌐 **多语言国际化 (i18n)**: 原生支持中/英双语无缝切换。
- 🎨 **动态多皮肤系统**: 支持多种精心设计的主题（例如深色、雪白、板岩、薰衣草等）动态刷新，自动记录用户选用偏好。
- 🕸️ **关系图谱可视化**: 采用 `react-force-graph-2d` 实现了交互式且直观的力导向图可视化，展示节点之间的“同义”、“反义”及延伸关系。根据成语解析状态，节点的大小及样式会自动更新。
- 🤖 **AI 获取和探索**: 如果数据库中缺失某成语的解释或相关联单词，可以通过集成的 AI 驱动系统手动/自动进行大模型请求补充，进而实现动态扩展路网。
- ✨ **丰富的视觉与动效体验**: 集成了 `framer-motion` 实现具有丝滑阻尼感的前端动效，侧边抽屉、标签切换等自然顺滑。
