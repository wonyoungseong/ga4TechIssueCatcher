#!/bin/bash

echo "Monitoring crawl for Phase 2..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
  status=$(curl -s http://localhost:3000/api/crawl/status)
  phase=$(echo "$status" | jq -r '.data.progress.phase // "null"')
  completed=$(echo "$status" | jq -r '.data.progress.completed // 0')
  total=$(echo "$status" | jq -r '.data.progress.total // 0')
  isRunning=$(echo "$status" | jq -r '.data.isRunning')

  if [ "$isRunning" = "false" ]; then
    echo "Crawl completed!"
    break
  fi

  if [ "$phase" = "2" ]; then
    elapsed=$(echo "$status" | jq -r '.data.progress.phase2ElapsedTime // 0')
    maxDur=$(echo "$status" | jq -r '.data.progress.phase2MaxDuration // 0')
    p2completed=$(echo "$status" | jq -r '.data.progress.phase2Completed // 0')
    p2total=$(echo "$status" | jq -r '.data.progress.phase2Total // 0')
    p2progress=$(echo "$status" | jq -r '.data.progress.phase2Progress // 0')

    if [ "$maxDur" != "0" ]; then
      variance=$(echo "scale=1; ($elapsed / $maxDur * 100) - 100" | bc)
      echo "[$(date +%H:%M:%S)] Phase 2: $p2completed/$p2total | ${elapsed}s/${maxDur}s (${variance}%) | Progress: ${p2progress}%"
    else
      echo "[$(date +%H:%M:%S)] Phase 2: $p2completed/$p2total | Calculating..."
    fi
  else
    echo "[$(date +%H:%M:%S)] Phase $phase: $completed/$total"
  fi

  sleep 3
done
