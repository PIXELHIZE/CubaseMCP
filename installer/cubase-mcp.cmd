@echo off
setlocal
set "CUBASE_MCP_ROOT=%~dp0"
"%CUBASE_MCP_ROOT%node.exe" "%CUBASE_MCP_ROOT%dist\server.js" %*

