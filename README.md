# Novel Reader - VS Code 状态栏小说阅读器

在 VS Code 状态栏中阅读小说，支持分页导航、章节跳转和老板模式（一键隐藏）。

## ✨ 功能特性

- 📖 **状态栏阅读** - 在状态栏左侧显示小说内容，不影响工作
- 📄 **分页导航** - 快捷键翻页，自定义每页字符数
- 📚 **章节跳转** - 自动解析目录，快速跳转到任意章节
- 🎯 **自定义正则** - 支持自定义正则表达式解析章节标题
- 🚀 **快捷键操作** - 所有操作都可通过快捷键完成
- 🔒 **老板模式** - 一键隐藏文本，隐藏时无法翻页（防止误触）
- ⚙️ **实时配置** - 支持运行时修改配置，无需重启

## 🚀 快速开始

### 1. 测试插件

1. 在 VS Code 中打开此项目 (`d:\file\AI\vscode_chajian`)
2. 按 `F5` 启动调试（会打开新的扩展开发窗口）
3. 在新窗口中按 `Ctrl+Shift+P` 打开命令面板
4. 输入 `Novel Reader: 选择小说文件`，选择一个 `.txt` 小说文件
5. 开始阅读！

### 2. 基本使用

1. **选择文件**：`Ctrl+Shift+P` → `Novel Reader: 选择小说文件`
2. **翻页阅读**：
   - `Ctrl+Alt+→` - 下一页
   - `Ctrl+Alt+←` - 上一页
3. **隐藏/显示**：
   - `Ctrl+Alt+H` - 隐藏文本（老板模式）
   - `Ctrl+Alt+S` - 显示文本
4. **章节跳转**：
   - `Ctrl+Alt+C` - 打开章节选择器
   - 或直接点击状态栏文字

## ⌨️ 快捷键列表

| 功能 | Windows/Linux | Mac | 说明 |
|------|--------------|-----|------|
| 下一页 | `Ctrl+Alt+→` | `Cmd+Alt+→` | 翻到下一页 |
| 上一页 | `Ctrl+Alt+←` | `Cmd+Alt+←` | 翻到上一页 |
| 显示文本 | `Ctrl+Alt+S` | `Cmd+Alt+S` | 显示小说内容 |
| 隐藏文本 | `Ctrl+Alt+H` | `Cmd+Alt+H` | 隐藏小说内容（老板模式） |
| 选择章节 | `Ctrl+Alt+C` | `Cmd+Alt+C` | 打开章节选择器 |

> 💡 所有快捷键都可以在 VS Code 的 `文件 → 首选项 → 键盘快捷方式` 中自定义

## ⚙️ 配置选项

打开 VS Code 设置（`Ctrl+,`），搜索 `Novel Reader`：

### novelReader.filePath
- **类型**：字符串
- **默认值**：空
- **说明**：小说文件的绝对路径
- **示例**：`D:\\novels\\三体.txt`

### novelReader.charsPerPage
- **类型**：数字
- **默认值**：60
- **范围**：10-200
- **说明**：每页显示的字符数（状态栏空间有限）
- **建议**：40-80 字符

### novelReader.chapterRegex
- **类型**：字符串
- **默认值**：`^第[0-9一二三四五六七八九十百千]+[章回节].*$`
- **说明**：用于匹配章节标题的正则表达式
- **示例**：
  - 匹配 "第一章"、"第二回"：`^第[0-9一二三四五六七八九十百千]+[章回节].*$`
  - 匹配 "Chapter 1"：`^Chapter\s+\d+.*$`
  - 匹配 "1. 标题"：`^\d+\.\s+.*$`

## 📖 使用示例

### 场景 1：快速阅读

```
1. 按 Ctrl+Shift+P，选择小说文件
2. 状态栏显示：$(book) 话说天下大势，分久必合，合久必分... [1/1250]
3. 按 Ctrl+Alt+→ 翻页
4. 看完一直按 → 就行了
```

### 场景 2：老板来了！

```
1. 正在看小说时，听到脚步声
2. 快速按 Ctrl+Alt+H（隐藏）
3. 状态栏立即清空，小说消失
4. 老板走后按 Ctrl+Alt+S（显示），继续阅读
```

### 场景 3：跳章节

```
1. 按 Ctrl+Alt+C 打开章节选择器
2. 输入章节名称搜索（如"第三章"）
3. 回车跳转
4. 自动定位到该章节第一页
```

## 🎨 状态栏显示格式

```
$(book) 小说内容文字... [页码/总页数]
```

**示例**：
```
$(book) 话说天下大势，分久必合，合久必分。周末七国分争，... [127/1250]
```

**鼠标悬停时显示**：
```
第一回 宴桃园豪杰三结义
页码: 127/1250
点击选择章节
```

## 🔒 老板模式特性

**隐藏时的行为**：
- ❌ 状态栏完全消失
- ❌ 翻页快捷键失效（防止误触）
- ✅ 保持当前阅读位置
- ✅ 可随时恢复显示

**安全提示**：
- 隐藏和显示使用不同快捷键（H 和 S）
- 隐藏时所有翻页操作都会被忽略
- 不会有任何弹窗提示（避免暴露）

## 📝 配置文件示例

在 VS Code 的 `settings.json` 中：

```json
{
  "novelReader.filePath": "D:\\novels\\三国演义.txt",
  "novelReader.charsPerPage": 60,
  "novelReader.chapterRegex": "^第[0-9一二三四五六七八九十百千]+回.*$"
}
```

## 🛠️ 开发和调试

### 开发环境

1. 克隆或打开项目
2. 按 `F5` 启动调试
3. 修改代码后重新加载窗口（`Ctrl+R`）

### 项目结构

```
vscode_chajian/
├── extension.js      # 核心逻辑（400+ 行）
├── package.json      # 插件配置和命令
├── README.md         # 使用说明
└── .vscode/
    └── launch.json   # 调试配置
```

### 核心 API

```javascript
// 创建状态栏项
statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  100
);

// 读取配置
const config = vscode.workspace.getConfiguration('novelReader');
const filePath = config.get('filePath');

// 文件选择对话框
const fileUri = await vscode.window.showOpenDialog(options);

// 章节选择器
const selected = await vscode.window.showQuickPick(items);
```

## 📦 打包和安装

### 打包为 .vsix

```bash
# 安装打包工具
npm install -g @vscode/vsce

# 打包插件
vsce package
```

### 手动安装

1. 在 VS Code 中打开扩展视图 (`Ctrl+Shift+X`)
2. 点击 `...` → `从 VSIX 安装`
3. 选择 `.vsix` 文件

## ❓ 常见问题

### Q: 为什么章节解析不出来？
A: 检查 `novelReader.chapterRegex` 配置，确保正则表达式匹配你的小说格式。

### Q: 每页字符太少/太多？
A: 修改 `novelReader.charsPerPage` 配置，建议 40-80 之间。

### Q: 隐藏后按翻页键没反应？
A: 这是正常的！隐藏模式下所有翻页操作都被禁用，防止误触暴露。先按 `Ctrl+Alt+S` 显示。

### Q: 快捷键冲突怎么办？
A: 在 VS Code 键盘快捷方式设置中自定义所有快捷键。

### Q: 支持哪些文件格式？
A: 目前仅支持 UTF-8 编码的 `.txt` 文件。

## 🎯 适用场景

- ✅ 工作间隙摸鱼看小说
- ✅ 需要快速隐藏的场景
- ✅ 小说文字阅读（非代码）
- ✅ 长篇小说分章节阅读

## 📄 许可证

MIT

---

**提示**：理性摸鱼，适度使用 😄
