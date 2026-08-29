@echo off
set NODE_DIR=C:\Users\Austi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin
set PATH=%NODE_DIR%;%PATH%
cd /d C:\Users\Austi\Downloads\Claude\myintel-platform
node node_modules\next\dist\bin\next dev --port 3100
