const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * 小说阅读器状态
 */
let novelState = {
  content: "",
  chapters: [],
  // 核心修改：使用 currentPos (当前字符位置) 替代 currentPage
  currentPos: 0, 
  totalPages: 0,
  currentChapter: 0,
  isVisible: false,
  charsPerPage: 20
};

let statusBarItem;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Novel Reader 插件已激活');

  // 创建状态栏项，显示在左侧
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.tooltip = "点击选择章节 | Ctrl+Alt+C";
  statusBarItem.command = 'novelReader.selectChapter';

  // 读取配置
  loadConfiguration();

  // 监听配置更改
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('novelReader')) {
        loadConfiguration();
      }
    })
  );

  // 注册所有命令
  context.subscriptions.push(
    vscode.commands.registerCommand('novelReader.selectFile', selectFile),
    vscode.commands.registerCommand('novelReader.nextPage', nextPage),
    vscode.commands.registerCommand('novelReader.prevPage', prevPage),
    vscode.commands.registerCommand('novelReader.show', showText),
    vscode.commands.registerCommand('novelReader.hide', hideText),
    vscode.commands.registerCommand('novelReader.selectChapter', selectChapter)
  );

  context.subscriptions.push(statusBarItem);

  // 如果配置了文件路径，自动加载
  const config = vscode.workspace.getConfiguration('novelReader');
  const filePath = config.get('filePath');
  if (filePath && fs.existsSync(filePath)) {
    loadNovel(filePath);
  }
}

/**
 * 加载配置
 */
function loadConfiguration() {
  const config = vscode.workspace.getConfiguration('novelReader');
  novelState.charsPerPage = config.get('charsPerPage', 60);
  
  // 如果已经加载了小说，重新分页
  if (novelState.content) {
    recalculatePages();
    updateStatusBar();
  }
}

/**
 * 选择小说文件
 */
async function selectFile() {
  const options = {
    canSelectMany: false,
    filters: {
      '文本文件': ['txt'],
      '所有文件': ['*']
    },
    title: '选择小说文件'
  };

  const fileUri = await vscode.window.showOpenDialog(options);
  
  if (fileUri && fileUri[0]) {
    const filePath = fileUri[0].fsPath;
    
    // 保存到配置
    const config = vscode.workspace.getConfiguration('novelReader');
    await config.update('filePath', filePath, vscode.ConfigurationTarget.Global);
    
    // 加载小说
    loadNovel(filePath);
  }
}

/**
 * 加载小说文件
 */
function loadNovel(filePath) {
  try {
    // 读取文件内容（自动检测编码，优先 UTF-8）
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 移除 BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    novelState.content = content;
    
    // 解析章节
    parseChapters();
    
    // 计算分页
    recalculatePages();
    
    // 重置到第一页
    novelState.currentPage = 0;
    novelState.currentChapter = 0;
    novelState.isVisible = true;
    
    updateStatusBar();
    
    // 加载成功，不显示提示
  } catch (error) {
    // 加载失败，静默处理
    console.error('加载小说失败:', error.message);
  }
}

/**
 * 解析章节
 */
function parseChapters() {
  const config = vscode.workspace.getConfiguration('novelReader');
  const chapterRegexStr = config.get('chapterRegex', '^\\s*第[0-9一二三四五六七八九十百千零]+[章回节].*$');
  
  try {
    // 必须加上 'g' 标志进行全局匹配
    const chapterRegex = new RegExp(chapterRegexStr, 'gm');
    const rawMatches = [];
    
    let match;
    while ((match = chapterRegex.exec(novelState.content)) !== null) {
      rawMatches.push({
        title: match[0].trim(),
        titleEnd: match.index + match[0].length,
        matchIndex: match.index
      });
    }
    
    // 去重：合并"装饰版标题 + 纯文本版标题"的重复对
    // 222.txt 中部分章节格式如下：
    //   ============================================================
    //     第1097章 照片能辟邪！（求全订！）   ← 装饰版（带前导空白）
    //   ============================================================
    //   第1097章 照片能辟邪！（求全订！）     ← 纯文本版
    // 两个匹配标题相同且距离很近时，跳过装饰版，保留纯文本版的内容起点
    novelState.chapters = [];
    let i = 0;
    while (i < rawMatches.length) {
      const current = rawMatches[i];
      const next = rawMatches[i + 1];
      
      if (next && 
          current.title === next.title && 
          next.matchIndex - current.matchIndex < 200) {
        // 装饰版 + 纯文本版：内容从纯文本版标题之后开始
        novelState.chapters.push({
          name: current.title,
          startPos: next.titleEnd,
          blockStart: current.matchIndex
        });
        i += 2;
      } else {
        novelState.chapters.push({
          name: current.title,
          startPos: current.titleEnd,
          blockStart: current.matchIndex
        });
        i += 1;
      }
    }
    
    // 设置每章的结束位置为下一章的 blockStart（避免装饰块混入上一章末尾）
    for (let j = 0; j < novelState.chapters.length; j++) {
      if (j < novelState.chapters.length - 1) {
        novelState.chapters[j].endPos = novelState.chapters[j + 1].blockStart;
      } else {
        novelState.chapters[j].endPos = novelState.content.length;
      }
    }
    
    // 兜底：如果没有章节
    if (novelState.chapters.length === 0) {
      novelState.chapters.push({ name: '全文', startPos: 0, endPos: novelState.content.length });
    }
    
  } catch (error) {
    console.error('章节解析失败:', error);
    novelState.chapters = [{ name: '全文', startPos: 0, endPos: novelState.content.length }];
  }
}

/**
 * 重新计算分页
 */
function recalculatePages() {
  if (!novelState.content) {
    novelState.totalPages = 0;
    return;
  }
  
  // 计算总页数
  novelState.totalPages = Math.ceil(novelState.content.length / novelState.charsPerPage);
}

/**
 * 获取当前页内容
 */
function getCurrentPageContent() {
  if (!novelState.content) return "请先选择小说";

  // 1. 处理位置越界
  if (novelState.currentPos < 0) novelState.currentPos = 0;
  if (novelState.currentPos >= novelState.content.length) {
    novelState.currentPos = novelState.content.length - novelState.charsPerPage;
  }

  const start = novelState.currentPos;
  // 确保不越界
  const end = Math.min(start + novelState.charsPerPage, novelState.content.length);

  // 2. 截取内容
  let text = novelState.content.substring(start, end);

  // 3. 格式化：去除开头的空白字符（关键体验优化：章节跳转后不显示空行）
  // 注意：如果 text 全是空白，可能需要多读一点，这里简单处理只做展示替换
  text = text.replace(/\s+/g, ' '); 
  
  return text;
}

/**
 * 获取当前所在章节
 */
function getCurrentChapterIndex() {
  const currentPos = novelState.currentPage * novelState.charsPerPage;
  
  for (let i = 0; i < novelState.chapters.length; i++) {
    if (currentPos >= novelState.chapters[i].startPos && 
        currentPos < novelState.chapters[i].endPos) {
      return i;
    }
  }
  
  return novelState.chapters.length - 1;
}

/**
 * 更新状态栏显示
 */
function updateStatusBar() {
  if (!novelState.isVisible || !novelState.content) {
    statusBarItem.hide();
    return;
  }

  // 动态计算当前的“页码”用于展示（仅用于展示进度）
  const currentPageDisplay = Math.floor(novelState.currentPos / novelState.charsPerPage) + 1;
  const totalPagesDisplay = Math.ceil(novelState.content.length / novelState.charsPerPage);

  // 查找当前章节名称
  const currentChapter = novelState.chapters.find(ch => 
    novelState.currentPos >= ch.startPos && novelState.currentPos < ch.endPos
  ) || novelState.chapters[novelState.chapters.length - 1];

  const pageContent = getCurrentPageContent();
  const chapterName = currentChapter ? currentChapter.name : '未知';

  statusBarItem.text = `${pageContent}`;
  statusBarItem.tooltip = `${chapterName}\n进度: ${(novelState.currentPos / novelState.content.length * 100).toFixed(2)}%`;
  statusBarItem.show();
}

/**
 * 下一页
 */
function nextPage() {
  if (!novelState.isVisible || !novelState.content) return;
  
  // 简单的加法，不再受限于整页倍数
  novelState.currentPos += novelState.charsPerPage;
  updateStatusBar();
}

/**
 * 上一页
 */
function prevPage() {
  if (!novelState.isVisible || !novelState.content) return;
  
  novelState.currentPos -= novelState.charsPerPage;
  updateStatusBar();
}

/**
 * 显示文本
 */
function showText() {
  novelState.isVisible = true;
  updateStatusBar();
}

/**
 * 隐藏文本（防止摸鱼被发现）
 */
function hideText() {
  novelState.isVisible = false;
  statusBarItem.hide();
}

/**
 * 选择章节
 */
/**
 * 选择章节
 */
async function selectChapter() {
  if (!novelState.content || novelState.chapters.length === 0) return;

  const items = novelState.chapters.map((chapter, index) => ({
    label: chapter.name,
    description: `进度: ${Math.floor(chapter.startPos / novelState.content.length * 100)}%`,
    index: index
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '跳转到章节'
  });

  if (selected) {
    const chapter = novelState.chapters[selected.index];
    
    // 核心修复：直接设置到章节的起始位置
    novelState.currentPos = chapter.startPos;
    
    // 简单的优化：如果章节开头全是换行符，跳过它们
    while (
      novelState.currentPos < novelState.content.length && 
      /\s/.test(novelState.content[novelState.currentPos])
    ) {
      novelState.currentPos++;
    }

    novelState.isVisible = true;
    updateStatusBar();
  }
}

function deactivate() {
  console.log('Novel Reader 插件已停用');
}

module.exports = {
  activate,
  deactivate
}
