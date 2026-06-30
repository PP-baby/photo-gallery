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

```powershell
cd C:\Users\DELL\Documents\网站搭建
npm start
```

然后打开：

```text
http://localhost:3000
```

## 本地保存位置

上传后的图片会保存到：

```text
uploads
```

照片列表、名称和标签会保存到：

```text
uploads/photos.json
```

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

### 3. 关于持久磁盘

这个项目包含 `render.yaml`，里面配置了 1GB 持久磁盘：

```yaml
disk:
  name: photo-uploads
  mountPath: /opt/render/project/src/uploads
  sizeGB: 1
```

这样上传的照片和 `photos.json` 会保存在 Render 的持久磁盘里。

注意：Render 的持久磁盘和可挂载磁盘的 Web Service 属于付费能力。如果你只想先免费测试域名和页面，可以先不使用持久磁盘，但上传的照片可能会在重启或重新部署后丢失。

## 整理照片

打开网站后，点击已上传照片右上角的“编辑”，可以修改照片名称和分类标签。

标签可以输入多个，例如：

```text
旅行, 海边, 家人
```

保存后，页面上方会自动出现对应标签。点击某个标签，就会只显示属于这个标签的照片。
