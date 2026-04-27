@echo off
chcp 65001 >nul
echo 正在启动记账 APP...
cd /d "%~dp0dist"
start "" http://localhost:8001
"C:\Users\d_mse\AppData\Local\Programs\Python\Python314\python.exe" -m http.server 8001
