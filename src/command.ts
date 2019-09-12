import * as glob from 'glob'
import * as util from 'util'

import { mirrorDirectories, watchDirectoriesForChangesAndMirror } from '.'

const goodGlob = util.promisify(glob)

async function doMain() {
  const args = process.argv
  let watch = false
  const srcDirs: string[] = []
  const destDirs: string[] = []
  let verbose = false

  for (let i = 2; i < args.length; ++i) {
    const arg = args[i]
    if (arg === '-w' || arg === '--watch') {
      watch = true
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true
    } else if (arg === '-s' || arg === '--source') {
      const globbedDirs = await goodGlob(args[++i])
      srcDirs.push(...globbedDirs)
    } else if (arg === '-d' || arg === '--dest') {
      const globbedDirs = await goodGlob(args[++i])
      destDirs.push(...globbedDirs)
    } else if (arg === '-h' || arg === '--help') {
      console.log(args[1] + ' [-h] [-v] [-s <dir>] [-d <dir]')
      process.exit(0)
    } else {
      throw new Error(`Unknown arg: ${arg}`)
    }
  }

  const syncs = srcDirs.map(srcDir => [srcDir, destDirs] as const)

  await mirrorDirectories(syncs, { verbose })
  if (watch) {
    await watchDirectoriesForChangesAndMirror(syncs, { verbose })
  }
}

export async function main() {
  try {
    // await to ensure exceptions are propagated
    await doMain()
  } catch (e) {
    console.error(typeof e === 'string' ? e : e.message)
    process.exit(1)
  }
}
