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

  /**
   * When true, do not empty files existing in the output directories before mirroring.
   */
  keep?: boolean
}

export interface Synchronisation {
  srcDirs: string[]
  destDirs: string[]

  /**
   * When false, each srcDir basename is created in each destDir, when true,
   * the contents of each srcDir are copied into each destDir.
   */
  rename: boolean
}

// each sync is a pair of source and destination
export type Synchronisations = ReadonlyArray<Readonly<Synchronisation>>

export async function mirrorDirectories(
  syncs: Synchronisations,
  options: Options = {},
): Promise<void> {
  if (!syncs.length) throw new Error('Must supply at least one copy')

  // copy source directories into dest directories
  await Promise.all(
    syncs.map(({ srcDirs, destDirs, rename }) => {
      if (options.verbose) {
        console.log('Synchronising %O -> %O', srcDirs, destDirs)
      }

      return Promise.all(
        srcDirs.map(srcDir =>
          Promise.all(
            destDirs.map(async destDir => {
              const fullDestDir = rename ? destDir : join(destDir, basename(srcDir))

              if (!options.keep) {
                await emptyDir(fullDestDir)
              }
              await copy(srcDir, fullDestDir)
            }),
          ),
        ),
      )
    }),
  )
}

export { watchDirectoriesForChangesAndMirror } from './watch'
