import { copy, emptyDir } from 'fs-extra'
import { join, basename } from 'path'

export interface Options {
  verbose?: boolean

  /**
   * When true use watchman's 'watch-project' command instead of 'watch'. This is more
   * efficient when multiple watchman projects are operating on the same directory tree
   * at the cost of watching more files and directories.
   */
  watchProject?: boolean
}

// each sync is a pair of source and destination
export type Synchronisations = ReadonlyArray<readonly [string, string[]]>

export async function mirrorDirectories(
  syncs: Synchronisations,
  options: Options = {},
): Promise<void> {
  if (!syncs.length) throw new Error('Must supply at least one copy')

  // copy source directories into dest directories
  await Promise.all(
    syncs.map(([srcDir, destDirs]) => {
      if (options.verbose) {
        console.log('Synchronising %O -> %O', srcDir, destDirs)
      }

      return Promise.all(
        destDirs.map(async destDir => {
          const fullDestDir = join(destDir, basename(srcDir))

          await emptyDir(fullDestDir)
          await copy(srcDir, fullDestDir)
        }),
      )
    }),
  )
}

export { watchDirectoriesForChangesAndMirror } from './watch'
