import { Client } from 'fb-watchman'
import { copy, unlink, emptyDir, realpath } from 'fs-extra'
import { join, basename, dirname } from 'path'

import type { Options, Synchronisations, Synchronisation } from '.'

interface FileChange {
  name: string
  exists: boolean
  type: 'f' | 'd'
}

interface CopyOperation {
  type: 'copy'
  root: string
  source: string
  destinations: string[]
}

interface RemoveOperation {
  type: 'remove'
  source: string
  destinations: string[]
}

type FileOperation = CopyOperation | RemoveOperation

/**
 * Ensure file operations happen in order to avoid race conditions
 */
class FileOperationQueue {
  pending: FileOperation[] = []
  running = false

  constructor(readonly verbose = false) {}

  push(op: FileOperation) {
    // remove pending operations for the same source since this one would only override it
    this.pending = this.pending.filter((pendingOp) => pendingOp.source !== op.source)
    this.pending.push(op)

    if (this.pending.length === 1 && !this.running) {
      this.running = true
      this.runNext()
    }
  }

  private async runNext() {
    const nextOp = this.pending.shift()!

    try {
      if (this.verbose) {
        console.log('modify filesystem %O', nextOp)
      }

      if (nextOp.type === 'remove') {
        await Promise.all(
          nextOp.destinations.map((destDir) => unlink(join(destDir, nextOp.source))),
        )
      } else if (nextOp.type === 'copy') {
        await Promise.all(
          nextOp.destinations.map((destDir) =>
            copy(join(nextOp.root, nextOp.source), join(destDir, nextOp.source)),
          ),
        )
      }
    } catch (e) {
      console.warn('Failed to execute operation %O: %O', nextOp, e)
    } finally {
      if (this.pending.length) {
        this.runNext()
      } else {
        this.running = false
      }
    }
  }
}

export async function watchDirectoriesForChangesAndMirror(
  syncs: Synchronisations,
  options: Options = {},
): Promise<never> {
  // map of full directory source to output directories
  const watchMap: Map<string, Synchronisation> = new Map()

  // build watchMap
  await Promise.all(
    syncs.map((sync) =>
      Promise.all(
        sync.srcDirs.map(async (srcDir) => {
          watchMap.set(await realpath(srcDir), sync)
        }),
      ),
    ),
  )

  if (!options.keep) {
    // empty destination directories
    await Promise.all(
      syncs.map(({ srcDirs, destDirs, rename }) =>
        Promise.all(
          srcDirs.map((srcDir) =>
            Promise.all(
              destDirs.map((destDir) =>
                emptyDir(rename ? destDir : join(destDir, basename(srcDir))),
              ),
            ),
          ),
        ),
      ),
    )
  }

  const opQueue = new FileOperationQueue(options.verbose)

  return new Promise((_, reject) => {
    const client = new Client()

    client.on('subscription', ({ root, files }) => {
      files.forEach(({ name, exists, type }: FileChange) => {
        const sync = watchMap.get(root)
        if (!sync) {
          console.warn('Unexpected watch root seen: %s', root)
          return
        }
        const isDirectory = type === 'd'
        if (exists) {
          if (isDirectory) {
            // ignore directory changes
            return
          }

          if (options.verbose) {
            console.log('file change: %s => %s to %O', root, name, sync.destDirs, type)
          }

          opQueue.push({
            type: 'copy',
            root: sync.rename ? root : dirname(root),
            source: sync.rename ? name : join(basename(root), name),
            destinations: sync.destDirs,
          })
        } else {
          if (options.verbose) {
            console.log(
              '%s remove: %s from %O',
              isDirectory ? 'directory' : 'file',
              name,
              sync.destDirs,
            )
          }

          opQueue.push({
            type: 'remove',
            source: sync.rename ? name : join(basename(root), name),
            destinations: sync.destDirs,
          })
        }
      })
    })

    client.capabilityCheck({ optional: [], required: ['relative_root'] }, async (error) => {
      const endAndReject = (message: string) => {
        client.end()
        reject(new Error(message))
      }

      if (error) {
        return endAndReject(`Could not confirm capabilities: ${error.message}`)
      }

      syncs.forEach(({ srcDirs }) =>
        Promise.all(
          srcDirs.map(async (srcDir) => {
            const fullSrcDir = await realpath(srcDir)
            client.command(
              [options.watchProject ? 'watch-project' : 'watch', fullSrcDir],
              (error, watchResp) => {
                if (error) {
                  return endAndReject(`Could not initiate watch: ${error.message}`)
                }

                const sub: any = {
                  expression: ['allof', ['match', '*']],
                  fields: ['name', 'exists', 'type'],
                }
                const relativePath = watchResp.relative_path
                if (relativePath) {
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  sub.relative_root = relativePath
                }

                client.command(['subscribe', watchResp.watch, 'sub-name', sub], (error) => {
                  if (error) {
                    return endAndReject(`Could not subscribe to changes: ${error.message}`)
                  }
                })
              },
            )
          }),
        ),
      )
    })
  })
}
