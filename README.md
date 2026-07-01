# 光影相册

一个个人照片分享网站，支持上传照片、永久保存、重命名、添加分类标签，以及按标签筛选整理。

## 功能

- 支持单张或多张照片一次上传。
- 上传后的照片会保存到 `uploads` 文件夹。
- 每张已上传照片可以重新命名。
- 每张已上传照片可以添加多个分类标签。
- 页面会根据所有照片标签自动生成筛选按钮。
- 浏览大图时可以点击左右箭头，或用键盘方向键切换上一张/下一张。

## 本地启动

如果要让本地和 Render 线上同步同一套照片，请先复制 `.env.example` 为 `.env`，并填入 Supabase 配置：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
SUPABASE_BUCKET=photos
MAX_UPLOAD_MB=50
```

`.env` 不会提交到 GitHub。

```powershell
cd C:\Users\DELL\Documents\网站搭建
npm start
```

然后打开：

```text
http://localhost:3000
```

## 本地保存位置

如果没有配置 Supabase，上传后的图片会保存到：

```text
uploads
```

照片列表、名称和标签会保存到：

```text
uploads/photos.json
```

如果配置了 Supabase，本地和线上都会读写同一个 Supabase Storage bucket 和 `public.photos` 数据表，`uploads` 只作为旧版本地数据备份。

## 迁移本地旧照片到 Supabase

部署 Supabase 版本后，可以把本地 `uploads` 里的旧照片上传到当前网站后端：

```powershell
npm run migrate:remote -- https://observer-photo-gallery.onrender.com
```

这条命令会读取本地 `uploads/photos.json`，把旧照片上传到线上。线上已经切换到 Supabase 后，这些照片会进入 Supabase，而不是 Render 临时磁盘。

## Render 部署

Render 会在部署 Web Service 后自动分配一个免费子域名，格式类似：

```text
https://photo-gallery-xxxx.onrender.com
```

### 1. 上传到 GitHub

把这个项目上传到 GitHub 仓库。`.gitignore` 已经排除了 `uploads` 里的照片文件，避免把本地私人照片传到仓库。

需要上传的核心文件包括：

```text
index.html
styles.css
script.js
server.js
package.json
render.yaml
README.md
uploads/.gitkeep
```

### 2. 在 Render 创建服务

进入：

```text
https://dashboard.render.com
```

点击：

```text
New -> Web Service
```

连接 GitHub 仓库后，配置如下：

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

服务创建完成后，Render 会给你一个 `onrender.com` 免费访问地址。

### 3. 关于 Supabase 存储

现在推荐使用 Supabase 保存照片和标签。Render 只负责运行网站代码，不再依赖 Render 临时磁盘或持久磁盘。

Render 需要配置这些环境变量：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BUCKET
```

配置完成后，本地和线上都会使用同一个云端照片库。

## 整理照片

打开网站后，点击已上传照片右上角的“编辑”，可以修改照片名称和分类标签。

标签可以输入多个，例如：

```text
旅行, 海边, 家人
```

保存后，页面上方会自动出现对应标签。点击某个标签，就会只显示属于这个标签的照片。
