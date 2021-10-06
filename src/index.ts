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

  /**
   * A list of directory names to exclude.
   */
  exclude?: string[]
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

async function syncDir(
  srcDir: string,
  destDir: string,
  rename: boolean,
  keep: boolean,
  exclude?: string[],
): Promise<void> {
  const fullDestDir = rename ? destDir : join(destDir, basename(srcDir))

  if (!keep) {
    await emptyDir(fullDestDir)
  }
  if (exclude) {
    await copy(srcDir, fullDestDir, {
      filter: (source) => {
        const relativeSource = source.substr(srcDir.length + 1)
        return !exclude.some(
          (excludePath) =>
            relativeSource === excludePath || relativeSource.startsWith(`${excludePath}/`),
        )
      },
    })
  } else {
    await copy(srcDir, fullDestDir)
  }
}

export async function mirrorDirectories(
  syncs: Synchronisations,
  options: Options = {},
): Promise<void> {
  if (!syncs.length) throw new Error('Must supply at least one copy')

  // copy source directories into dest directories
  await Promise.all(
    syncs.map(async ({ srcDirs, destDirs, rename }) => {
      if (options.verbose) {
        console.log('Synchronising %O -> %O', srcDirs, destDirs)
      }

      if (rename) {
        if (!options.keep) {
          await Promise.all(destDirs.map((dir) => emptyDir(dir)))
        }

        // do not parallelise, files in subsequent directories must override
        // those in previous directories
        for (const srcDir of srcDirs) {
          await Promise.all(
            destDirs.map((destDir) => syncDir(srcDir, destDir, true, true, options.exclude)),
          )
        }
      } else {
        return Promise.all(
          srcDirs.map((srcDir) =>
            Promise.all(
              destDirs.map((destDir) =>
                syncDir(srcDir, destDir, false, Boolean(options.keep), options.exclude),
              ),
            ),
          ),
        )
      }
    }),
  )
}

export { watchDirectoriesForChangesAndMirror } from './watch'
