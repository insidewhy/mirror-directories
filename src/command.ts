import * as glob from 'glob'
import * as util from 'util'

import {
  mirrorDirectories,
  Options,
  watchDirectoriesForChangesAndMirror,
  Synchronisations,
} from '.'

const goodGlob = util.promisify(glob)

async function doMain(): Promise<void> {
  const args = process.argv
  let watch = false
  const srcDirs: string[] = []
  const destDirs: string[] = []
  const mirrors: string[][] = []
  const options: Options = {}

  for (let i = 2; i < args.length; ++i) {
    const arg = args[i]
    if (arg === '-w' || arg === '--watch') {
      watch = true
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true
    } else if (arg === '-p' || arg === '--watch-project') {
      options.watchProject = true
    } else if (arg === '-k' || arg === '--keep') {
      options.keep = true
    } else if (arg === '-s' || arg === '--source') {
      const globbedDirs = await goodGlob(args[++i])
      srcDirs.push(...globbedDirs)
    } else if (arg === '-d' || arg === '--dest') {
      const globbedDirs = await goodGlob(args[++i], { nonull: true })
      destDirs.push(...globbedDirs)
    } else if (arg === '-m' || arg === '--mirror') {
      const mirror = args[++i].split(':')
      if (mirror.length < 2) {
        throw new Error(`There must be at least one colon when using -m but got: ${args[i]}`)
      }
      mirrors.push(mirror)
    } else if (arg === '-h' || arg === '--help') {
      console.log(args[1] + ' [-h] [-v] [-p] [-s <dir>] [-d <dir]')
      process.exit(0)
    } else {
      throw new Error(`Unknown arg: ${arg}`)
    }
  }

  const syncs: Synchronisations = [
    ...srcDirs.map((srcDir) =>
      Object.freeze({
        srcDirs: [srcDir],
        destDirs,
        rename: srcDir.endsWith('/'),
      }),
    ),
    ...mirrors.map((dirs) => {
      const srcDirs = dirs.slice(0, -1)
      const renames = srcDirs.filter((dir) => dir.endsWith('/'))
      const rename = Boolean(renames.length)
      if (rename && renames.length !== srcDirs.length) {
        throw new Error(
          'When using -m with a source directory with a trailing slash all or none of the source directories must have a trailing slash',
        )
      }

      return Object.freeze({
        srcDirs,
        destDirs: dirs.slice(-1),
        rename,
      })
    }),
  ]

  if (watch) {
    // the watcher emits the current state first so there's no need to run
    // mirrorDirectories first
    await watchDirectoriesForChangesAndMirror(syncs, options)
  } else {
    await mirrorDirectories(syncs, options)
  }
}

export async function main(): Promise<void> {
  try {
    // await to ensure exceptions are propagated
    await doMain()
  } catch (e) {
    console.error(typeof e === 'string' ? e : e.message)
    process.exit(1)
  }
}
