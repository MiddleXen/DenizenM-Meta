#!/bin/bash
git pull
npm install
npm run sync-meta
npm run build
