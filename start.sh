#!/bin/bash
npm run build
PORT=${PORT:-8098} npm run start
