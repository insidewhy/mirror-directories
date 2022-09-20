import { copy, emptyDir } from 'fs-extra'
import { Minimatch, IMinimatch } from 'minimatch'
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

  /**
   * A list of minimatch patterns to exclude
   */
  excludePatterns?: string[]
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
  exclude: string[] | undefined,
  minimatchers: IMinimatch[] | undefined,
): Promise<void> {
  const fullDestDir = rename ? destDir : join(destDir, basename(srcDir))

  if (!keep) {
    await emptyDir(fullDestDir)
  }
  if (exclude || minimatchers) {
    await copy(srcDir, fullDestDir, {
      filter: (source) => {
        const relativeSource = source.substr(srcDir.length + 1)
        return !(
          exclude?.some(
            (excludePath) =>
              relativeSource === excludePath || relativeSource.startsWith(`${excludePath}/`),
          ) || minimatchers?.some((minimatcher) => minimatcher.match(relativeSource))
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

  const minimatchers = options.excludePatterns?.map(
    (pattern) => new Minimatch(pattern, { matchBase: true }),
  )

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
            destDirs.map((destDir) =>
              syncDir(srcDir, destDir, true, true, options.exclude, minimatchers),
            ),
          )
        }
      } else {
        return Promise.all(
          srcDirs.map((srcDir) =>
            Promise.all(
              destDirs.map((destDir) =>
                syncDir(
                  srcDir,
                  destDir,
                  false,
                  Boolean(options.keep),
                  options.exclude,
                  minimatchers,
                ),
              ),
            ),
          ),
        )
      }
    }),
  )
}

export { watchDirectoriesForChangesAndMirror } from './watch'
