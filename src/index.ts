import { copy, emptyDir } from 'fs-extra'
import { join, basename } from 'path'

interface Options {
  verbose?: boolean
}

// each sync is a pair of source and destination
type Synchronisations = Array<readonly [string, string[]]>

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

export async function watchDirectoriesForChangesAndMirror(
  syncs: Synchronisations,
  options: Options = {},
): Promise<never> {
  throw new Error('not implemented')
}
