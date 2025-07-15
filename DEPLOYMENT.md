# PDF阅读器部署文档

## 服务端口配置

### 主要服务
| 服务名称 | 端口 | 协议 | 描述 | PM2名称 |
|---------|------|------|------|---------|
| PDF阅读器 | 6788 | HTTP | 主应用服务 | pdf-reader |
| 中文TTS | 6501 | HTTP | 中文语音合成 | - |
| 英文TTS | 6100 | HTTP | 英文语音合成 | tts-server |

### 域名映射
| 域名 | 目标服务 | 用途 |
|------|----------|------|
| https://pdf.mattwu.cc | 6788端口 | PDF阅读器主页 |
| https://ttszh.mattwu.cc | 6501端口 | 中文TTS API |
| https://tts.mattwu.cc | 6100端口 | 英文TTS API |

## PM2服务管理

### 启动所有服务
```bash
# 启动PDF阅读器
cd /home/ubuntu/app/pdf-reader
pm2 start "python3 -m http.server 6788" --name pdf-reader

# 启动中文TTS服务
cd /home/ubuntu/app/chineseapi
pm2 start "python3 chinese_tts_api.py" --name chinese-tts

# 启动英文TTS服务（已配置）
# pm2 start "python3 server.py --port 6100" --name tts-server
```

### 常用PM2命令
```bash
pm2 status              # 查看所有服务状态
pm2 logs pdf-reader     # 查看PDF阅读器日志
pm2 logs chinese-tts    # 查看中文TTS日志
pm2 logs tts-server     # 查看英文TTS日志
pm2 restart pdf-reader  # 重启PDF阅读器
pm2 stop pdf-reader     # 停止PDF阅读器
pm2 save               # 保存PM2配置
pm2 startup            # 设置开机启动
```

## 快速部署指南

### 1. 系统要求
- Ubuntu 20.04+
- Python 3.8+
- Node.js 16+ (用于PM2)

### 2. 安装依赖
```bash
# 安装PM2
npm install -g pm2

# 安装Python依赖
pip3 install fastapi uvicorn

# 安装中文TTS依赖
cd /home/ubuntu/app/melotts/MeloTTS
pip3 install -e .
```

### 3. 克隆项目
```bash
# 克隆PDF阅读器
git clone https://github.com/matt6wu/pdf2.git /home/ubuntu/app/pdf-reader

# 设置中文TTS服务
cd /home/ubuntu/app/chineseapi
# 确保chinese_tts_api.py文件存在
```

### 4. 启动服务
```bash
# 启动PDF阅读器
cd /home/ubuntu/app/pdf-reader
pm2 start "python3 -m http.server 6788" --name pdf-reader

# 启动中文TTS
cd /home/ubuntu/app/chineseapi
pm2 start "python3 chinese_tts_api.py" --name chinese-tts

# 保存PM2配置
pm2 save
pm2 startup
```

### 5. 防火墙配置
```bash
# 开放端口
sudo ufw allow 6788
sudo ufw allow 6501
sudo ufw allow 6100

# 或者使用iptables
sudo iptables -A INPUT -p tcp --dport 6788 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6501 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6100 -j ACCEPT
```

## 故障排除

### 常见问题

1. **端口被占用**
```bash
# 查看端口占用
ss -tlnp | grep 6788
ss -tlnp | grep 6501
ss -tlnp | grep 6100

# 杀死占用进程
kill -9 <PID>
```

2. **服务无法启动**
```bash
# 检查日志
pm2 logs pdf-reader
pm2 logs chinese-tts

# 重启服务
pm2 restart pdf-reader
pm2 restart chinese-tts
```

3. **TTS服务报错**
```bash
# 检查中文TTS服务
curl -X POST http://localhost:6501/tts -H "Content-Type: application/json" -d '{"text":"测试"}'

# 检查英文TTS服务
curl "http://localhost:6100/api/tts?text=test&speaker_id=p335"
```

### 性能优化

1. **内存使用**
```bash
# 查看内存使用
pm2 monit

# 重启高内存服务
pm2 restart tts-server
```

2. **磁盘空间**
```bash
# 清理日志
pm2 flush
pm2 reloadLogs
```

## 备份恢复

### 备份重要文件
```bash
# 备份PDF阅读器代码
tar -czf pdf-reader-backup.tar.gz /home/ubuntu/app/pdf-reader

# 备份中文TTS服务
tar -czf chinese-tts-backup.tar.gz /home/ubuntu/app/chineseapi

# 备份PM2配置
pm2 save
cp ~/.pm2/dump.pm2 ./pm2-backup.json
```

### 恢复服务
```bash
# 恢复代码
tar -xzf pdf-reader-backup.tar.gz -C /

# 恢复PM2配置
pm2 resurrect pm2-backup.json
```

## 版本信息
- PDF阅读器版本: v2.4
- 中文TTS: MeloTTS
- 英文TTS: Mozilla TTS
- 最后更新: 2025-07-15

## 联系信息
- GitHub: https://github.com/matt6wu/pdf2
- 服务器: 207.211.157.86
- 维护者: Claude Code AI