#!/bin/sh
set -e
npx prisma db push --accept-data-loss 2>/dev/null || true
exec node dist/index.js
