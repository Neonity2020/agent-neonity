# Windows 终端常用快捷键操作指南

## 光标移动

| 快捷键 | 功能 |
|--------|------|
| `Home` | 跳到行首 |
| `End` | 跳到行尾 |
| `←` / `→` | 向左 / 向右移动一个字符 |
| `Ctrl + ←` | 向左跳一个词 |
| `Ctrl + →` | 向右跳一个词 |
| `Ctrl + Home` | 跳到命令历史开头 |
| `Ctrl + End` | 跳到命令历史末尾 |

## 删除与清空

| 快捷键 | 功能 |
|--------|------|
| `Backspace` | 删除光标前一个字符 |
| `Delete` | 删除光标后一个字符 |
| `Ctrl + Home` | 删除光标前的所有内容（清空到行首） |
| `Ctrl + End` | 删除光标后的所有内容（清空到行尾） |
| `Ctrl + Backspace` | 删除光标前一个单词 |
| `Esc` | 清空当前整行输入 |

> 清空整行最快的方式：按 `Esc` 一步到位

## 文本选择

| 快捷键 | 功能 |
|--------|------|
| `鼠标左键拖拽` | 选中文本 |
| `鼠标双击` | 选中一个单词 |
| `鼠标三击` | 选中整行 |
| `Ctrl + A` | 全选（CMD 中）；在 PowerShell 中为跳到行首 |
| `Shift + ←` / `→` | 逐字符选择 |
| `Shift + Ctrl + ←` / `→` | 逐单词选择 |
| `Shift + Home` | 选中到行首 |
| `Shift + End` | 选中到行尾 |

## 复制与粘贴

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + C` | 复制选中文本 / 终止当前程序 |
| `Ctrl + V` | 粘贴文本 |
| `Ctrl + Shift + C` | 复制（Windows Terminal） |
| `Ctrl + Shift + V` | 粘贴（Windows Terminal） |
| `Enter` | 选中状态下按回车即可复制（CMD 默认行为） |
| `右键单击` | 粘贴（CMD / PowerShell 默认行为） |

## 历史命令

| 快捷键 | 功能 |
|--------|------|
| `↑` / `↓` | 浏览上一条 / 下一条历史命令 |
| `F8` | 根据当前输入搜索历史命令 |
| `Ctrl + R` | 搜索历史命令（PowerShell / Windows Terminal） |
| `F7` | 显示历史命令列表（CMD） |
| `F9` | 按编号选择历史命令（CMD） |
| `Page Up` | 跳到历史命令第一条 |
| `Page Down` | 跳到历史命令最后一条 |

## 进程控制

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + C` | 终止当前运行的程序 |
| `Ctrl + Break` | 强制终止当前程序 |
| `Ctrl + Z` | 挂起（Unix 子系统如 WSL） |
| `Alt + F4` | 关闭终端窗口 |

## 屏幕操作

| 快捷键 | 功能 |
|--------|------|
| `cls` | 清屏（CMD / PowerShell 命令） |
| `Ctrl + L` | 清屏（PowerShell / Windows Terminal） |
| `Ctrl + Shift + L` | 清屏（Windows Terminal） |

## 标签页与窗口（Windows Terminal）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Shift + T` | 新建标签页 |
| `Ctrl + Shift + W` | 关闭当前标签页 |
| `Ctrl + Shift + N` | 新建终端窗口 |
| `Ctrl + Tab` | 切换到下一个标签页 |
| `Ctrl + Shift + Tab` | 切换到上一个标签页 |
| `Ctrl + Alt + 数字` | 切换到对应编号的标签页 |
| `Ctrl + Shift + D` | 复制当前标签页 |
| `Alt + Shift + D` | 拆分当前窗格 |

## 窗格拆分（Windows Terminal）

| 快捷键 | 功能 |
|--------|------|
| `Alt + Shift + D` | 自动拆分窗格 |
| `Alt + Shift + -` | 水平拆分窗格 |
| `Alt + Shift + +` | 垂直拆分窗格 |
| `Alt + 方向键` | 在窗格之间切换焦点 |
| `Ctrl + Shift + W` | 关闭当前窗格 |

## CMD vs PowerShell vs Windows Terminal 差异速查

| 功能 | CMD | PowerShell | Windows Terminal |
|------|-----|------------|-----------------|
| 粘贴 | 右键 | 右键 / Ctrl+V | Ctrl+Shift+V |
| 复制 | Enter（选中后） | Ctrl+C（选中后） | Ctrl+Shift+C |
| 清屏 | `cls` | `cls` / Ctrl+L | Ctrl+Shift+L |
| 搜索历史 | F7 | Ctrl+R | Ctrl+R |
| 全选 | Ctrl+A | 无直接快捷键 | Ctrl+Shift+A |
