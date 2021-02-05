# mirror-directories

[![build status](https://circleci.com/gh/insidewhy/mirror-directories.png?style=shield)](https://circleci.com/gh/insidewhy/mirror-directories)
[![Known Vulnerabilities](https://snyk.io/test/github/insidewhy/mirror-directories/badge.svg)](https://snyk.io/test/github/insidewhy/mirror-directories)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)

## Usage

### Example 1

Recursively copy all the directories matching the glob `src/*` to `out1` and `out2`:

```bash
% mirror-directories -s 'src/*' -d out1 -d out2
```

If `src/project1` and `src/project2` exist then they will be copied to `out1/project1`, `out1/project2`, `out2/project1` and `out2/project2`.

Existing contents of the destination directories will be erased before the copying occurs such that the destination directories will mirror the source directories exactly.

### Example 2

Recursively copy `src1` and `src2` to all the directories matching `destinations/*`:

```bash
% mirror-directories -s src1 -s src2 -d 'destinations/*'
```

If `destinations/birthday` and `destinations/fear` exist then at the end `destinations/{birthday,fear}/{src1,src2}` will be exact copies of their respective source directories.

### Example 3

A trailing slash can be used to copy the contents of the source directory into the destination directory.

```bash
% mirror-directories -s 'src/' -d out
```

Creates `out` as a mirror of `src` instead of creating `out/src` as a mirror of `src`. This corresponds to the `rename` option of the API.

### Example 4

The `-m` argument can be used to specify independent source/dest pairs.

```bash
% mirror-directories -m src:out -m friends/:enemies
```

This will mirror `src` to `out/src` and the contents of the `friends` directory to the `enemies` directory.

### Example 5

The `-m` argument can be used to specify multiple source directories for a single dest directory. Either all of none of the source directories must have a trailing slash. When all source directories have a trailing slash, meaning all of them relate to rename watches, files in latter source directories will take precedence over those specified earlier.

```bash
% mirror-directories -m src1/:src2/:out
```

In this circumstance if both `src1/file` and `src2/file` exist then `out/file` will always mirror `src2/file`. If `-w` were used then any changes to `src1/file` would be ignored. Removing `src2/file` would lead to `out/file` being a mirror of `src1/file` until `src2/file` is recreated.

## API

This library also exports an API:

```typescript
import { mirrorDirectories, watchDirectoriesForChangesAndMirror } from 'mirror-directories'

// the default options are { keep: false, rename: false }
mirrorDirectories([
  { srcDirs: ['src1'], destDirs: ['dest1', 'dest2'] },
  { srcDirs: ['src2', 'src3'], destDirs: ['dest2', 'dest3'] },
])

watchDirectoriesForChangesAndMirror([{ srcDirs: ['src4'], destDirs: ['dest4', 'dest5'] }], {
  // keep existing contents in destination directories
  keep: true,
  // use watchman's "watch-project" command rather than "watch"
  watchProject: true,
  // mirrors `src4` to `dest4` and `dest5` instead of
  // `dest4/src4` and `dest5/src4`
  rename: true,
})
```
