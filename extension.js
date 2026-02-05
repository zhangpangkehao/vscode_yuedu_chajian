const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * 小说阅读器状态
 */
let novelState = {
  content: "",           // 完整小说内容
  chapters: [],          // [{name: "第一章", startPos: 0, endPos: 1000}, ...]
  currentPage: 0,        // 当前页码（全局）
  totalPages: 0,         // 总页数
  currentChapter: 0,     // 当前章节索引
  isVisible: false,      // 是否显示在状态栏
  charsPerPage: 20       // 每页字符数
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
  const chapterRegexStr = config.get('chapterRegex', '^第[0-9一二三四五六七八九十百千]+[章回节].*$');
  
  try {
    const chapterRegex = new RegExp(chapterRegexStr, 'm');
    const lines = novelState.content.split(/\r?\n/);
    
    novelState.chapters = [];
    let currentPos = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (chapterRegex.test(line)) {
        // 找到章节标题
        if (novelState.chapters.length > 0) {
          // 设置上一章的结束位置（当前位置，即新章节标题的开始）
          novelState.chapters[novelState.chapters.length - 1].endPos = currentPos;
        }
        
        // 计算章节内容的起始位置：跳过标题行和后续的空行
        let contentStartPos = currentPos + lines[i].length + 1; // 先跳过标题行
        
        // 继续向后查找，跳过所有空行
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '') {
            // 空行，继续跳过
            contentStartPos += lines[j].length + 1;
          } else {
            // 找到第一个非空行，这是真正的内容开始
            break;
          }
        }
        
        novelState.chapters.push({
          name: line,
          startPos: contentStartPos, // 从第一个非空行开始
          endPos: novelState.content.length // 临时值
        });
      }
      
      currentPos += lines[i].length + 1; // +1 for newline
    }
    
    // 如果没有找到章节，创建一个默认章节
    if (novelState.chapters.length === 0) {
      novelState.chapters.push({
        name: '全文',
        startPos: 0,
        endPos: novelState.content.length
      });
    } else {
      // 设置最后一章的结束位置
      novelState.chapters[novelState.chapters.length - 1].endPos = novelState.content.length;
    }
  } catch (error) {
    // 章节解析失败，静默处理
    console.error('章节解析失败:', error.message);
    // 创建默认章节
    novelState.chapters = [{
      name: '全文',
      startPos: 0,
      endPos: novelState.content.length
    }];
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
  if (!novelState.content || novelState.totalPages === 0) {
    return "请先选择小说文件";
  }
  
  const startPos = novelState.currentPage * novelState.charsPerPage;
  const endPos = Math.min(startPos + novelState.charsPerPage, novelState.content.length);
  
  let pageContent = novelState.content.substring(startPos, endPos);
  
  // 移除换行符，用空格替代
  pageContent = pageContent.replace(/\s+/g, ' ').trim();
  
  return pageContent;
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
  
  const pageContent = getCurrentPageContent();
  novelState.currentChapter = getCurrentChapterIndex();
  
  const chapterName = novelState.chapters[novelState.currentChapter]?.name || '未知章节';
  const pageInfo = `[${novelState.currentPage + 1}/${novelState.totalPages}]`;
  
  statusBarItem.text = `$(book) ${pageContent} ${pageInfo}`;
  statusBarItem.tooltip = `${chapterName}\n页码: ${novelState.currentPage + 1}/${novelState.totalPages}\n点击选择章节`;
  statusBarItem.show();
}

/**
 * 下一页
 */
function nextPage() {
  // 关键：隐藏状态下不允许翻页
  if (!novelState.isVisible) {
    return;
  }
  
  if (!novelState.content) {
    return;
  }
  
  if (novelState.currentPage < novelState.totalPages - 1) {
    novelState.currentPage++;
    updateStatusBar();
  }
}

/**
 * 上一页
 */
function prevPage() {
  // 关键：隐藏状态下不允许翻页
  if (!novelState.isVisible) {
    return;
  }
  
  if (!novelState.content) {
    return;
  }
  
  if (novelState.currentPage > 0) {
    novelState.currentPage--;
    updateStatusBar();
  }
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
async function selectChapter() {
  if (!novelState.content || novelState.chapters.length === 0) {
    return;
  }
  
  // 创建章节列表
  const items = novelState.chapters.map((chapter, index) => {
    const startPage = Math.floor(chapter.startPos / novelState.charsPerPage) + 1;
    return {
      label: chapter.name,
      description: `第 ${startPage} 页开始`,
      index: index
    };
  });
  
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要跳转的章节'
  });
  
  if (selected) {
    // 跳转到该章节的第一页
    novelState.currentPage = Math.floor(novelState.chapters[selected.index].startPos / novelState.charsPerPage);
    novelState.currentChapter = selected.index;
    novelState.isVisible = true; // 跳转后自动显示
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
