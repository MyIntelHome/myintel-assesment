@echo off
set NODE_DIR=C:\Users\Austi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin
set PATH=%NODE_DIR%;%PATH%
set PNPM=C:\Users\Austi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs
cd /d C:\Users\Austi\Downloads\Claude\myintel-assessment
node "%PNPM%" run dev
