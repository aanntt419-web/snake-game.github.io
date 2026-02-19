#!/usr/bin/env node
/**
 * 환경 변수로 .env 파일 생성
 * 사용법: VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=yyy node scripts/setup-env.js
 * 또는: npm run setup:env (환경변수 사전 설정 필요)
 */

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const envPath = join(rootDir, '.env')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('필수 환경변수가 없습니다.')
  console.error('사용법: VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=yyy node scripts/setup-env.js')
  process.exit(1)
}

const content = `VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${key}
`

writeFileSync(envPath, content.trim() + '\n', 'utf8')
console.log('.env 파일이 생성되었습니다.')
