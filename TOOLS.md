# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your. specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## 🎤 语音能力（Speech Capabilities）

### 语音转文字（Speech-to-Text）

**工具：** OpenAI Whisper（开源免费版本）

**安装信息：**
- 版本：20250625
- 安装方式：pipx install openai-whisper
- 路径：/opt/homebrew/bin/whisper
- 模型：tiny, base, small, medium, large（可选）

**使用方法：**
1. **自动转录**：用户发送语音消息 → 自动下载 → Whisper 转录 → 返回文本
2. **命令行**：`whisper audio.ogg --language Chinese --model base`
3. **Python**：`import whisper; model = whisper.load_model("base")`

**支持格式：**
- 音频：mp3, wav, m4a, oga, ogg, flac, opus 等
- 语言：100+ 种语言（包括中文、英文、日文等）
- 输出：txt, srt, vtt, json, tsv

**特点：**
- ✅ 完全免费开源
- ✅ 本地运行，无需联网
- ✅ 隐私安全（数据不离开本地）
- ✅ 无使用限制
- ✅ 高准确率（95%+）

**推荐配置：**
- 日常使用：base 模型（平衡速度和准确率）
- 高准确率：medium 或 large 模型
- 快速转录：tiny 或 base 模型

**示例文件：**
- /Users/felixmiao/WHISPER_QUICKSTART.md - 快速开始指南
- /Users/felixmiao/whisper_example.py - Python 示例
- /Users/felixmiao/realtime_transcriber.py - 实时录音示例
- /Users/felixmiao/whisper-examples.sh - 命令行示例

---

## 📞 语音通话（Voice Call）

**工具：** OpenClaw voice-call plugin

**用途：** 打电话（Twilio, Telnyx, Plivo）

**CLI：**
```bash
openclaw voicecall call --to "+15555550123" --message "Hello"
openclaw voicecall status --call-id <id>
```

**注意：** 需要启用 voice-call plugin 并配置 provider

---

## 🎯 下次使用

**用户可以直接：**
1. 发送语音消息 → 我会自动转录
2. 发送音频文件 → 我会自动转录
3. 要求实时录音 → 使用 realtime_transcriber.py

**无需额外说明，我已经具备语音转录能力！** ✅

---

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
