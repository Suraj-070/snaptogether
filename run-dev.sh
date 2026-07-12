#!/bin/bash
cd /home/z/my-project
while true; do
  node ./node_modules/.bin/next dev -p 3000 -H 0.0.0.0 2>&1 | tee /tmp/next-dev.log
  echo "Restarting in 2s..."
  sleep 2
done