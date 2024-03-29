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
    } else if (arg === '-e' || arg === '--exclude') {
      if (!options.exclude) {
        options.exclude = []
      }
      options.exclude.push(args[++i])
    } else if (arg === '-P' || arg === '--exclude-pattern') {
      if (!options.excludePatterns) {
        options.excludePatterns = []
      }
      options.excludePatterns.push(args[++i])
    } else if (arg === '-h' || arg === '--help') {
      console.log(args[1] + ' [arguments]')
      console.log()
      console.log('where arguments are')
      console.log(' -h/--help                     show this message')
      console.log(' -v/--verbose                  increase verbosity')
      console.log(" -p/--watch-project            use watchman's watch-project option")
      console.log(' -s/--source <dir>             set source directory to mirror from')
      console.log(' -d/--dest <dir>               set destination directory to mirror to')
      console.log(
        ' -m/--mirror <dirs>            specify colon separated source directories followed by dest directory',
      )
      console.log(
        ' -e/--exclude <dir>            exclude directory paths (relative to source directories) from mirror',
      )
      console.log(' -P/--exclude-pattern <match>  exclude paths matching match using micromatch')
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
      if (rename) {
        if (renames.length !== srcDirs.length) {
          throw new Error(
            'When using -m with a source directory with a trailing slash all or none of the source directories must have a trailing slash',
          )
        }
        return Object.freeze({
          srcDirs: srcDirs.map((srcDir) => srcDir.slice(0, -1)),
          destDirs: dirs.slice(-1),
          rename,
        })
      } else {
        return Object.freeze({
          srcDirs,
          destDirs: dirs.slice(-1),
          rename,
        })
      }
    }),
  ]

  if (watch) {
    // the watcher emits the current state first so there's no need to run
    // mirrorDirectories first
    const watcher = await watchDirectoriesForChangesAndMirror(syncs, options)
    await watcher.waitForWatches
    const stopWatching = watcher.stop
    process.on('exit', stopWatching)
    process.on('SIGTERM', stopWatching)
    process.on('SIGINT', stopWatching)
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
