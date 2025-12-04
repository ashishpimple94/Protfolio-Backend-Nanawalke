#!/bin/bash
# Script to kill all processes on port 5000

echo "Killing all processes on port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 1
if lsof -ti:5000 > /dev/null 2>&1; then
  echo "Some processes are still running. Trying again..."
  pkill -f "node.*server.js" || true
  sleep 1
  lsof -ti:5000 | xargs kill -9 2>/dev/null || true
fi

if lsof -ti:5000 > /dev/null 2>&1; then
  echo "Warning: Port 5000 is still in use. Please check manually."
  lsof -ti:5000
else
  echo "Port 5000 is now free!"
fi


