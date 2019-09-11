import { copy, emptyDir } from 'fs-extra'
import { join, basename } from 'path'

interface Options {
  verbose?: boolean
}

export async function mirrorDirectories(
  srcDirs: string[],
  destDirs: string[],
  options: Options = {},
): Promise<void> {
  if (!srcDirs.length) throw new Error('Must supply at least one source directory')
  if (!destDirs.length) throw new Error('Must supply at least one destination directory')

  if (options.verbose) {
    console.log('Copying %O to %O', srcDirs, destDirs)
  }

  // delete contents of dest directories
  await Promise.all(destDirs.map(destDir => emptyDir(destDir)))

  // copy source directories into dest directories
  await Promise.all(
    srcDirs.map(srcDir => {
      return Promise.all(
        destDirs.map(destDir => {
          return copy(srcDir, join(destDir, basename(srcDir)))
        }),
      )
    }),
  )
}

export async function watchDirectoriesForChangesAndMirror(
  srcDirs: string[],
  destDirs: string[],
  options: Options = {},
): Promise<void> {
  throw new Error('not implemented')
  return Promise.resolve()
}
