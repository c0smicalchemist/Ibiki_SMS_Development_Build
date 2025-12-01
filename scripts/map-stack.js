import fs from 'fs'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'

function mapOne(mapPath, line, column) {
  const raw = fs.readFileSync(mapPath, 'utf8')
  const tm = new TraceMap(raw)
  const pos = originalPositionFor(tm, { line: Number(line), column: Number(column) })
  return pos
}

if (process.argv.length < 5) {
  console.error('Usage: node scripts/map-stack.js <mapPath> <line> <column>')
  process.exit(1)
}

const [, , mapPath, line, column] = process.argv
const res = mapOne(mapPath, line, column)
console.log(JSON.stringify({ input: { line: Number(line), column: Number(column) }, output: res }, null, 2))
